import { fail } from "../utils/common.js";
export const roles =
  (...allowed) =>
  (req, res, next) => {
    if (!allowed.includes(req.user.role))
      fail(403, "Your role cannot perform this action.");
    next();
  };
