import bcrypt from "bcrypt";
import User from "../models/User.js";
import Evidence from "../models/Evidence.js";
import { audit, fail, field, id, ok, transaction } from "../utils/common.js";
export async function listUsers(req, res) {
  ok(res, await User.find().sort({ createdAt: -1 }));
}
export async function recipients(req, res) {
  ok(
    res,
    await User.find({
      isActive: true,
      role: { $in: ["investigator", "forensic"] },
    }).select("name email role"),
  );
}
export async function createUser(req, res) {
  const name = field(req.body.name, "Name", 100),
    email = field(req.body.email, "Email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    fail(400, "Enter a valid email.");
  const password = field(req.body.password, "Password", 72);
  if (Buffer.byteLength(password) > 72 || password.length < 8)
    fail(400, "Password must have 8–72 bytes.");
  if (!["admin", "investigator", "forensic"].includes(req.body.role))
    fail(400, "Invalid role.");
  const hashed = await bcrypt.hash(password, 12);
  let user;
  await transaction(async (session) => {
    [user] = await User.create(
      [{ name, email, role: req.body.role, password: hashed }],
      { session },
    );
    await audit(
      req,
      "USER_CREATED",
      null,
      `${name} (${req.body.role})`,
      session,
    );
  });
  ok(
    res,
    { id: user.id, name, email, role: user.role, isActive: user.isActive },
    "User created.",
    201,
  );
}
export async function userStatus(req, res) {
  id(req.params.id);
  if (req.params.id === req.user.id)
    fail(400, "You cannot deactivate your own account.");
  if (typeof req.body.isActive !== "boolean")
    fail(400, "isActive must be true or false.");
  let user;
  await transaction(async (session) => {
    user = await User.findById(req.params.id).session(session);
    if (!user) fail(404, "User not found.");
    if (
      !req.body.isActive &&
      (await Evidence.exists({ currentHolder: user._id }).session(session))
    )
      fail(
        409,
        "Reassign this user’s evidence before deactivating the account.",
      );
    user.isActive = req.body.isActive;
    await user.save({ session });
    await audit(
      req,
      user.isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
      null,
      user.name,
      session,
    );
  });
  ok(res, user);
}
