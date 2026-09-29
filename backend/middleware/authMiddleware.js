import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { fail } from "../utils/common.js";
export async function auth(req, res, next) {
  let payload;
  try {
    payload = jwt.verify(
      req.headers.authorization?.replace(/^Bearer /, "") || "",
      process.env.JWT_SECRET,
      { algorithms: ["HS256"] },
    );
  } catch {
    fail(401, "Please log in again.");
  }
  const user = await User.findById(payload.id);
  if (!user?.isActive) fail(401, "Please log in again.");
  req.user = user;
  next();
}
