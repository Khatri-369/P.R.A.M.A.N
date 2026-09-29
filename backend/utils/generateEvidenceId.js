import mongoose from "mongoose";
const Counter = mongoose.model(
  "Counter",
  new mongoose.Schema({ _id: String, value: Number }),
);
export async function generateEvidenceId() {
  const year = new Date().getFullYear();
  const counter = await Counter.findByIdAndUpdate(
    String(year),
    { $inc: { value: 1 } },
    { upsert: true, new: true },
  );
  return `EV-${year}-${String(counter.value).padStart(4, "0")}`;
}
