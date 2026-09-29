import mongoose from "mongoose";
export async function connectDB() {
  if (!process.env.MONGO_URI)
    throw new Error("Set MONGO_URI in .env. See README for replica set setup.");
  await mongoose.connect(process.env.MONGO_URI);
}
