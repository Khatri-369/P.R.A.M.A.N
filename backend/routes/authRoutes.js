import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login, logout } from "../controllers/authController.js";
import { auth } from "../middleware/authMiddleware.js";
import { ok } from "../utils/common.js";
const router = Router();
router.post(
  "/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    message: {
      success: false,
      message: "Too many login attempts. Try again later.",
    },
  }),
  login,
);
router.get("/me", auth, (req, res) =>
  ok(res, {
    id: req.user.id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role,
  }),
);
router.post("/logout", auth, logout);
export default router;
