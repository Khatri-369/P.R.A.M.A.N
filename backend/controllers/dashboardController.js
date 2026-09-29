import Evidence from "../models/Evidence.js";
import User from "../models/User.js";
import CustodyLog from "../models/CustodyLog.js";
import { scope } from "./evidenceController.js";
import { ok } from "../utils/common.js";
export async function stats(req, res) {
  const filter = scope(req);
  const [
    totalEvidence,
    verifiedEvidence,
    pendingEvidence,
    failedIntegrity,
    recentEvidence,
    grouped,
  ] = await Promise.all([
    Evidence.countDocuments(filter),
    Evidence.countDocuments({ ...filter, integrityStatus: "Verified" }),
    Evidence.countDocuments({ ...filter, integrityStatus: "Not Checked" }),
    Evidence.countDocuments({ ...filter, integrityStatus: "Failed" }),
    Evidence.find(filter)
      .sort({ createdAt: -1 })
      .limit(6)
      .populate("currentHolder", "name"),
    Evidence.aggregate([
      { $match: filter },
      { $group: { _id: "$evidenceType", count: { $sum: 1 } } },
    ]),
  ]);
  const ids =
    req.user.role === "forensic"
      ? await Evidence.find(filter).distinct("_id")
      : null;
  const recentActivity = await CustodyLog.find(
    ids ? { evidence: { $in: ids } } : {},
  )
    .populate("performedBy", "name")
    .populate("evidence", "evidenceId")
    .sort({ timestamp: -1 })
    .limit(6);
  ok(res, {
    totalEvidence,
    verifiedEvidence,
    pendingEvidence,
    failedIntegrity,
    totalUsers:
      req.user.role === "admin" ? await User.countDocuments() : undefined,
    recentEvidence,
    recentActivity,
    evidenceByType: grouped,
  });
}
