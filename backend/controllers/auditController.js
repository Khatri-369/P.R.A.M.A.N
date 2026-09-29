import AuditLog from "../models/AuditLog.js";
import Evidence from "../models/Evidence.js";
import { create } from "xmlbuilder2";
import { audit, fail, field, id, ok, paging } from "../utils/common.js";
async function filterFor(query) {
  const filter = {};
  if (query.action) filter.action = field(query.action, "Action", 100);
  if (query.user) filter.user = id(query.user);
  if (query.evidenceId) {
    const evidence = await Evidence.findOne({
      evidenceId: field(query.evidenceId, "Evidence ID", 50),
    });
    filter.evidence = evidence?._id || null;
  }
  if (query.evidenceId && filter.evidence === null) filter._id = null;
  if (query.startDate || query.endDate) {
    filter.timestamp = {};
    for (const [key, operator] of [
      ["startDate", "$gte"],
      ["endDate", "$lte"],
    ])
      if (query[key]) {
        if (
          typeof query[key] !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(query[key])
        )
          fail(400, "Use YYYY-MM-DD dates.");
        const date = new Date(
          query[key] +
            (key === "endDate" ? "T23:59:59.999Z" : "T00:00:00.000Z"),
        );
        if (Number.isNaN(date.getTime())) fail(400, "Invalid date.");
        filter.timestamp[operator] = date;
      }
    if (filter.timestamp.$gte > filter.timestamp.$lte)
      fail(400, "Start date must precede end date.");
  }
  return filter;
}
export async function listAudit(req, res) {
  const filter = await filterFor(req.query),
    { page, limit, skip } = paging(req.query);
  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .populate("user", "name email")
      .populate("evidence", "evidenceId title")
      .sort({ timestamp: -1, _id: -1 })
      .skip(skip)
      .limit(limit),
    AuditLog.countDocuments(filter),
  ]);
  ok(res, { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}
export async function exportAudit(req, res) {
  const filter = await filterFor(req.query);
  const xml = create({ version: "1.0" }).ele("AuditLogs");
  for await (const log of AuditLog.find(filter)
    .populate("user", "name")
    .populate("evidence", "evidenceId")
    .sort({ timestamp: 1 })
    .cursor()) {
    const node = xml.ele("Log");
    for (const [key, value] of Object.entries({
      Action: log.action,
      EvidenceId: log.evidence?.evidenceId,
      User: log.user?.name || "Unauthenticated",
      Details: log.details,
      Timestamp: log.timestamp.toISOString(),
    }))
      node.ele(key).txt(value || "");
  }
  await audit(req, "XML_EXPORTED", null, "Audit export");
  res
    .attachment("praman-audit.xml")
    .type("application/xml")
    .send(xml.end({ prettyPrint: true }));
}
