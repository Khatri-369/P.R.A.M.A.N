import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { audit, fail, ok } from "../utils/common.js";
const dummyHash = await bcrypt.hash("unused-timing-equalization-password", 12);
export async function login(req, res) {
  const { email, password } = req.body;
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    email.length > 254 ||
    password.length > 200
  )
    fail(400, "Enter a valid email and password.");
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select(
    "+password",
  );
  const matches = await bcrypt.compare(password, user?.password || dummyHash);
  if (!matches || !user?.isActive) {
    await audit(req, "LOGIN_FAILED", null, "Invalid credentials");
    fail(401, "Invalid email or password.");
  }
  req.user = user;
  await audit(req, "LOGIN_SUCCESS");
  const data = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
  ok(res, {
    token: jwt.sign(data, process.env.JWT_SECRET, {
      expiresIn: "8h",
      algorithm: "HS256",
    }),
    user: data,
  });
}
export async function logout(req, res) {
  await audit(req, "LOGOUT");
  ok(res, null, "Logged out.");
}
