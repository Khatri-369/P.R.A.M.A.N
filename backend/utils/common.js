import mongoose from "mongoose";
import AuditLog from "../models/AuditLog.js";
import CustodyLog from "../models/CustodyLog.js";
export function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
export function id(value) {
  if (typeof value !== "string" || !/^[a-f0-9]{24}$/i.test(value))
    fail(400, "Invalid record ID.");
  return value;
}
export function field(value, name, max = 200, required = true) {
  if (
    typeof value !== "string" ||
    value.trim().length > max ||
    (required && !value.trim())
  )
    fail(400, `${name} is required and must be at most ${max} characters.`);
  return value.trim();
}
export function paging(query) {
  const page = Number(query.page || 1),
    limit = Number(query.limit || 10);
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  )
    fail(400, "Invalid pagination.");
  return { page, limit, skip: (page - 1) * limit };
}
export function ok(res, data, message = "Success", status = 200) {
  return res.status(status).json({ success: true, message, data });
}
export async function audit(req, action, evidence, details = "", session) {
  await AuditLog.create(
    [{ user: req.user?._id, action, evidence, details, ipAddress: req.ip }],
    { session },
  );
}
export async function custody(
  req,
  evidence,
  action,
  remarks,
  session,
  fromUser,
  toUser,
) {
  await CustodyLog.create(
    [
      {
        evidence,
        action,
        remarks,
        performedBy: req.user._id,
        fromUser,
        toUser,
      },
    ],
    { session },
  );
}
// A transaction commits the state change and its history together.
export async function transaction(work) {
  return mongoose.connection.transaction(work);
}
