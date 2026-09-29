import { Router } from "express";
import * as controller from "../controllers/evidenceController.js";
import { roles } from "../middleware/roleMiddleware.js";
import { upload } from "../middleware/uploadMiddleware.js";
const router = Router();
router.get("/", controller.listEvidence);
router.post("/", roles("investigator"), upload, controller.uploadEvidence);
router.get("/:id", controller.details);
router.get("/:id/download", controller.download);
router.post(
  "/:id/verify",
  roles("investigator", "forensic"),
  controller.verify,
);
router.post(
  "/:id/notes",
  roles("investigator", "forensic"),
  controller.addNote,
);
router.patch("/:id/status", roles("forensic"), controller.changeStatus);
export default router;
