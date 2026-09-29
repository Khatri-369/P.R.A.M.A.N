import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["admin", "investigator", "forensic"],
      required: true,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
export default mongoose.model("User", schema);
