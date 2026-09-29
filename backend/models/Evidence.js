import mongoose from "mongoose";
export const statuses = [
  "Uploaded",
  "Under Review",
  "Assigned",
  "Verified",
  "Archived",
];
export const types = ["Document", "Image", "Text", "Other"];
const ref = {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
  required: true,
};
const schema = new mongoose.Schema(
  {
    evidenceId: { type: String, unique: true, required: true },
    caseNumber: { type: String, required: true },
    title: { type: String, required: true },
    description: String,
    evidenceType: { type: String, enum: types, required: true },
    originalFilename: String,
    storedFilename: { type: String, select: false },
    filePath: { type: String, select: false },
    mimeType: String,
    fileSize: Number,
    sha256Hash: { type: String, required: true, immutable: true },
    uploadedBy: ref,
    uploadedAt: { type: Date, default: Date.now },
    currentHolder: ref,
    status: { type: String, enum: statuses, default: "Uploaded" },
    notes: [
      {
        text: String,
        author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    lastVerifiedAt: Date,
    integrityStatus: {
      type: String,
      enum: ["Not Checked", "Verified", "Failed"],
      default: "Not Checked",
    },
  },
  { timestamps: true },
);
export default mongoose.model("Evidence", schema);
