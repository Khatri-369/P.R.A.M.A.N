import path from "node:path";
import { unlink, access } from "node:fs/promises";
import Evidence, { statuses, types } from "../models/Evidence.js";
import { calculateFileHash } from "../utils/hashFile.js";
import { generateEvidenceId } from "../utils/generateEvidenceId.js";
import { inspectFile } from "../middleware/uploadMiddleware.js";
import {
  audit,
  custody,
  fail,
  field,
  id,
  ok,
  paging,
  transaction,
} from "../utils/common.js";
export function scope(req) {
  return req.user.role === "forensic" ? { currentHolder: req.user._id } : {};
}
export async function getAccessible(
  req,
  evidenceId,
  session,
  withPath = false,
) {
  const query = Evidence.findOne({
    _id: id(evidenceId),
    ...scope(req),
  }).session(session || null);
  if (withPath) query.select("+filePath");
  const evidence = await query;
  if (!evidence) fail(404, "Evidence not found or not assigned to you.");
  return evidence;
}
const populate = [
  { path: "uploadedBy currentHolder", select: "name email role" },
  { path: "notes.author", select: "name role" },
];
export async function listEvidence(req, res) {
  const filter = scope(req),
    { page, limit, skip } = paging(req.query);
  for (const [key, target, allowed] of [
    ["status", "status", statuses],
    ["type", "evidenceType", types],
  ]) {
    if (req.query[key]) {
      if (!allowed.includes(req.query[key])) fail(400, "Invalid filter.");
      filter[target] = req.query[key];
    }
  }
  if (req.query.caseNumber)
    filter.caseNumber = field(req.query.caseNumber, "Case number", 100);
  if (req.query.search) {
    const escaped = field(req.query.search, "Search", 200).replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );
    filter.$or = ["title", "evidenceId", "caseNumber", "description"].map(
      (key) => ({ [key]: { $regex: escaped, $options: "i" } }),
    );
  }
  const [items, total] = await Promise.all([
    Evidence.find(filter)
      .populate(populate)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Evidence.countDocuments(filter),
  ]);
  ok(res, { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}
export async function uploadEvidence(req, res) {
  if (!req.file) fail(400, "Choose an evidence file.");
  let committed = false;
  try {
    const title = field(req.body.title, "Title"),
      caseNumber = field(req.body.caseNumber, "Case number", 100);
    const description = field(
      req.body.description || "",
      "Description",
      4000,
      false,
    );
    const note = field(req.body.notes || "", "Notes", 4000, false);
    if (!types.includes(req.body.evidenceType))
      fail(400, "Invalid evidence type.");
    await inspectFile(req.file);
    const sha256Hash = await calculateFileHash(req.file.path),
      evidenceId = await generateEvidenceId();
    let evidence;
    await transaction(async (session) => {
      [evidence] = await Evidence.create(
        [
          {
            evidenceId,
            title,
            caseNumber,
            description,
            evidenceType: req.body.evidenceType,
            originalFilename: path
              .basename(req.file.originalname)
              .replace(/[^a-zA-Z0-9._ -]/g, "_"),
            storedFilename: req.file.filename,
            filePath: req.file.path,
            mimeType: req.file.mimetype,
            fileSize: req.file.size,
            sha256Hash,
            uploadedBy: req.user._id,
            currentHolder: req.user._id,
            notes: note ? [{ text: note, author: req.user._id }] : [],
          },
        ],
        { session },
      );
      await custody(
        req,
        evidence._id,
        "UPLOADED",
        note || "Evidence recorded.",
        session,
        null,
        req.user._id,
      );
      await audit(req, "EVIDENCE_UPLOADED", evidence._id, evidenceId, session);
    });
    committed = true;
    ok(
      res,
      await Evidence.findById(evidence._id).populate(populate),
      "Evidence uploaded successfully.",
      201,
    );
  } finally {
    if (!committed) await unlink(req.file.path).catch(() => {});
  }
}
export async function details(req, res) {
  const evidence = await getAccessible(req, req.params.id);
  await evidence.populate(populate);
  await audit(req, "EVIDENCE_VIEWED", evidence._id);
  ok(res, evidence);
}
export async function verify(req, res) {
  let result;
  await transaction(async (session) => {
    const evidence = await getAccessible(req, req.params.id, session, true);
    let currentHash = null,
      missing = false;
    try {
      currentHash = await calculateFileHash(evidence.filePath);
    } catch (error) {
      if (error.code === "ENOENT") missing = true;
      else throw error;
    }
    evidence.integrityStatus =
      currentHash === evidence.sha256Hash ? "Verified" : "Failed";
    evidence.lastVerifiedAt = new Date();
    await evidence.save({ session });
    const remarks = missing
      ? "INTEGRITY CHECK FAILED: stored file is missing."
      : `Integrity ${evidence.integrityStatus}`;
    await custody(req, evidence._id, "VERIFIED", remarks, session);
    await audit(req, "EVIDENCE_VERIFIED", evidence._id, remarks, session);
    result = {
      originalHash: evidence.sha256Hash,
      currentHash,
      status: evidence.integrityStatus,
      verificationDate: evidence.lastVerifiedAt,
      missing,
    };
  });
  ok(res, result);
}
export async function addNote(req, res) {
  const text = field(req.body.text, "Note", 4000);
  await transaction(async (session) => {
    const evidence = await getAccessible(req, req.params.id, session);
    evidence.notes.push({ text, author: req.user._id });
    await evidence.save({ session });
    await custody(req, evidence._id, "NOTE_ADDED", text, session);
    await audit(req, "NOTE_ADDED", evidence._id, text, session);
  });
  ok(res, null, "Note added.");
}
export async function changeStatus(req, res) {
  if (!statuses.includes(req.body.status)) fail(400, "Invalid status.");
  await transaction(async (session) => {
    const evidence = await getAccessible(req, req.params.id, session);
    if (
      req.body.status === "Verified" &&
      evidence.integrityStatus !== "Verified"
    )
      fail(409, "Verify integrity before marking this evidence Verified.");
    const remarks = `${evidence.status} → ${req.body.status}`;
    evidence.status = req.body.status;
    await evidence.save({ session });
    await custody(req, evidence._id, "STATUS_CHANGED", remarks, session);
    await audit(req, "STATUS_CHANGED", evidence._id, remarks, session);
  });
  ok(res, null, "Status updated.");
}
export async function download(req, res) {
  const evidence = await getAccessible(req, req.params.id, null, true);
  try {
    await access(evidence.filePath);
  } catch {
    fail(404, "The stored file is unavailable.");
  }
  await audit(req, "EVIDENCE_DOWNLOADED", evidence._id);
  res.download(path.resolve(evidence.filePath), evidence.originalFilename);
}
