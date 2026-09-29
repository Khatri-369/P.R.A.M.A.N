import { Router } from "express";
import {
  listUsers,
  createUser,
  userStatus,
  recipients,
} from "../controllers/userController.js";
import { roles } from "../middleware/roleMiddleware.js";
const router = Router();
router.get("/recipients", roles("admin", "investigator"), recipients);
router.use(roles("admin"));
router.get("/", listUsers);
router.post("/", createUser);
router.patch("/:id/status", userStatus);
export default router;
