import User from "../models/User.js";
import CustodyLog from "../models/CustodyLog.js";
import { getAccessible } from "./evidenceController.js";
import {
  audit,
  custody,
  fail,
  field,
  id,
  ok,
  transaction,
} from "../utils/common.js";
import { create } from "xmlbuilder2";
export async function custodyRecords(req) {
  const evidence = await getAccessible(req, req.params.evidenceId);
  const logs = await CustodyLog.find({ evidence: evidence._id })
    .populate("performedBy fromUser toUser", "name email role")
    .sort({ timestamp: 1, _id: 1 });
  return { evidence, logs };
}
export async function listCustody(req, res) {
  const { evidence, logs } = await custodyRecords(req);
  ok(res, { evidenceId: evidence.evidenceId, logs });
}
export async function transfer(req, res) {
  id(req.body.evidenceId);
  id(req.body.toUserId);
  const remarks = field(req.body.remarks, "Transfer remarks", 2000);
  let result;
  await transaction(async (session) => {
    const evidence = await getAccessible(req, req.body.evidenceId, session);
    if (
      req.user.role !== "admin" &&
      String(evidence.currentHolder) !== req.user.id
    )
      fail(403, "Only the current holder or an admin can transfer evidence.");
    if (String(evidence.currentHolder) === req.body.toUserId)
      fail(400, "Choose a different holder.");
    // Writing the recipient serializes transfer with account deactivation.
    const recipient = await User.findOneAndUpdate(
      {
        _id: req.body.toUserId,
        isActive: true,
        role: { $in: ["investigator", "forensic"] },
      },
      { $set: { updatedAt: new Date() } },
      { session, new: true },
    );
    if (!recipient)
      fail(
        400,
        "Recipient must be an active investigator or forensic officer.",
      );
    const fromUser = evidence.currentHolder;
    evidence.currentHolder = recipient._id;
    evidence.status = "Assigned";
    await evidence.save({ session });
    await custody(
      req,
      evidence._id,
      "TRANSFERRED",
      remarks,
      session,
      fromUser,
      recipient._id,
    );
    await audit(req, "EVIDENCE_TRANSFERRED", evidence._id, remarks, session);
    result = evidence;
  });
  ok(res, result, "Custody transferred.");
}
export async function exportCustody(req, res) {
  const { evidence, logs } = await custodyRecords(req);
  const xml = create({ version: "1.0" }).ele("ChainOfCustody", {
    evidenceId: evidence.evidenceId,
  });
  for (const log of logs) {
    const node = xml.ele("Event");
    for (const [key, value] of Object.entries({
      Action: log.action,
      PerformedBy: log.performedBy?.name,
      From: log.fromUser?.name,
      To: log.toUser?.name,
      Remarks: log.remarks,
      Timestamp: log.timestamp.toISOString(),
    }))
      node.ele(key).txt(value || "");
  }
  await audit(req, "XML_EXPORTED", evidence._id, "Custody export");
  res
    .attachment(`${evidence.evidenceId}-custody.xml`)
    .type("application/xml")
    .send(xml.end({ prettyPrint: true }));
}
