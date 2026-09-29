import { Router } from "express";
import {
  listCustody,
  transfer,
  exportCustody,
} from "../controllers/custodyController.js";
import { roles } from "../middleware/roleMiddleware.js";
const router = Router();
router.post("/transfer", roles("admin", "investigator"), transfer);
router.get("/:evidenceId/export/xml", roles("admin"), exportCustody);
router.get("/:evidenceId", listCustody);
export default router;
