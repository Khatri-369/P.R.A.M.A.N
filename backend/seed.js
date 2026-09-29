import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { pathToFileURL } from "node:url";
import User from "./models/User.js";
import Evidence from "./models/Evidence.js";
import CustodyLog from "./models/CustodyLog.js";
import AuditLog from "./models/AuditLog.js";
import { connectDB } from "./config/db.js";
export async function seed() {
  await Promise.all([
    User.init(),
    Evidence.init(),
    CustodyLog.init(),
    AuditLog.init(),
  ]);
  for (const [name, role, password] of [
    ["Demo Admin", "admin", "Admin@123"],
    ["Demo Investigator", "investigator", "Investigator@123"],
    ["Demo Forensic Officer", "forensic", "Forensic@123"],
  ]) {
    const email = `${role}@praman.com`;
    if (!(await User.exists({ email })))
      await User.create({
        name,
        role,
        email,
        password: await bcrypt.hash(password, 12),
      });
  }
  console.log("Demo users ready. Existing users were not changed.");
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    await connectDB();
    await seed();
  } catch (error) {
    console.error("Seed failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
