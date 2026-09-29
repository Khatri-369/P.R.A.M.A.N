import mongoose from "mongoose";
export default mongoose.model(
  "AuditLog",
  new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    action: { type: String, required: true },
    evidence: { type: mongoose.Schema.Types.ObjectId, ref: "Evidence" },
    details: String,
    ipAddress: String,
    timestamp: { type: Date, default: Date.now },
  }),
);
