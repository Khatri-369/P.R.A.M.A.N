import { MongoMemoryReplSet } from "mongodb-memory-server";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import mongoose from "mongoose";
// Demo mode runs real MongoDB in a temporary replica set. Data resets on restart.
const directory = await mkdtemp(path.join(tmpdir(), "praman-demo-"));
process.env.UPLOAD_DIR = directory;
process.env.JWT_SECRET = randomBytes(48).toString("hex");
console.log(
  "Starting temporary MongoDB. First launch may download the MongoDB binary.",
);
const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
process.env.MONGO_URI = mongo.getUri("praman");
const { connectDB } = await import("./config/db.js");
const { seed } = await import("./seed.js");
const { createApp } = await import("./app.js");
await connectDB();
await seed();
const server = createApp().listen(process.env.PORT || 5000, () =>
  console.log(
    `PRAMAN DEMO: http://localhost:${process.env.PORT || 5000} — temporary data; resets on restart.`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    server.close();
    await mongoose.disconnect();
    await mongo.stop();
    await rm(directory, { recursive: true, force: true });
    process.exit(0);
  });
