import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../../common/middlewares/auth.middleware";
import { requirePermission } from "../../common/middlewares/rbac.middleware";
import { validate } from "../../common/middlewares/validate.middleware";
import { ApiError } from "../../common/utils/ApiError";
import { PERMISSIONS } from "../rbac/permissions";
import * as controller from "./studentImport.controller";
import {
  bulkApproveSchema,
  listRowsQuerySchema,
  listSessionsQuerySchema,
  rejectRowSchema,
  rowActionParamSchema,
  sessionIdParamSchema,
} from "./studentImport.validation";

const EXCEL_EXTENSIONS = [".xlsx", ".xls"];
const EXCEL_MIMETYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
  "application/octet-stream", // some browsers/OSes send this for either — extension check backstops it
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB — comfortably fits a 1000-row student sheet (§19)
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf("."));
    const looksLikeExcel = EXCEL_EXTENSIONS.includes(ext) && EXCEL_MIMETYPES.includes(file.mimetype);
    if (!looksLikeExcel) return cb(new ApiError(400, "BAD_REQUEST", "শুধুমাত্র .xlsx বা .xls ফাইল আপলোড করা যাবে।"));
    cb(null, true);
  },
});

const router = Router();

router.use(requireAuth);

// Bulk Student Upload is gated by the same STUDENTS_CREATE permission the
// normal Admission Form uses — it's the same underlying action (creating a
// Student), just through a different UI, not a separate privilege (§15/§27).
const canImport = requirePermission(PERMISSIONS.STUDENTS_CREATE);

// Fixed-segment routes first — see material.routes.ts's own comment for why
// this ordering matters once a router mixes literal and "/:id"-style paths.
router.get("/template", canImport, controller.downloadTemplate);
router.get("/history", canImport, validate(listSessionsQuerySchema), controller.listHistory);
router.post("/upload", canImport, upload.single("file"), controller.upload);

router.get("/:sessionId", canImport, validate(sessionIdParamSchema), controller.getSession);
router.get("/:sessionId/rows", canImport, validate(listRowsQuerySchema), controller.listRows);
// Fixed segments ("bulk-approve"/"valid-ids") before the "/:rowId/..." param routes, same ordering rule as above.
router.get("/:sessionId/rows/valid-ids", canImport, validate(sessionIdParamSchema), controller.listValidRowIds);
router.post("/:sessionId/rows/bulk-approve", canImport, validate(bulkApproveSchema), controller.bulkApprove);
router.post("/:sessionId/rows/:rowId/approve", canImport, validate(rowActionParamSchema), controller.approveRow);
router.post("/:sessionId/rows/:rowId/reject", canImport, validate(rejectRowSchema), controller.rejectRow);

export default router;
