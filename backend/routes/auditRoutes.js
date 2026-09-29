import { Router } from "express";
import { listAudit, exportAudit } from "../controllers/auditController.js";
const router = Router();
router.get("/export/xml", exportAudit);
router.get("/", listAudit);
export default router;
