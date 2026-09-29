import mongoose from "mongoose";
const ref = { type: mongoose.Schema.Types.ObjectId, ref: "User" };
export default mongoose.model(
  "CustodyLog",
  new mongoose.Schema({
    evidence: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Evidence",
      required: true,
    },
    action: {
      type: String,
      enum: [
        "UPLOADED",
        "ASSIGNED",
        "TRANSFERRED",
        "VERIFIED",
        "STATUS_CHANGED",
        "NOTE_ADDED",
      ],
      required: true,
    },
    fromUser: ref,
    toUser: ref,
    performedBy: ref,
    remarks: String,
    timestamp: { type: Date, default: Date.now },
  }),
);
