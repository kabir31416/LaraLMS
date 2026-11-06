import { Router } from "express";
import { requireAuth } from "../../common/middlewares/auth.middleware";
import { requirePermission } from "../../common/middlewares/rbac.middleware";
import { validate } from "../../common/middlewares/validate.middleware";
import { publicResultLimiter } from "../../common/middlewares/rateLimit.middleware";
import { PERMISSIONS as P } from "../rbac/permissions";
import * as c from "./cards.controller";
import * as v from "./cards.validation";

/**
 * Every route checks the permission here AND the record scope in the service
 * (a Batch Director only ever reaches their own batches' students; a student
 * only their own card, resolved from the token, never from the URL).
 */
const idRead = requirePermission(P.ID_CARDS_MANAGE, P.ID_CARDS_READ_OWN_BATCH);
const idManage = requirePermission(P.ID_CARDS_MANAGE);
const examRead = requirePermission(P.ADMIT_CARDS_MANAGE, P.ADMIT_CARDS_READ_OWN_BATCH);
const examManage = requirePermission(P.ADMIT_CARDS_MANAGE);

export const idCardRoutes = Router();
idCardRoutes.use(requireAuth);
idCardRoutes.get("/me", requirePermission(P.ID_CARDS_READ_OWN), c.idMine);
idCardRoutes.get("/settings", requirePermission(P.ID_CARDS_MANAGE, P.ID_CARDS_READ_OWN_BATCH, P.ADMIT_CARDS_MANAGE, P.ADMIT_CARDS_READ_OWN_BATCH), c.getSettings);
idCardRoutes.patch("/settings", requirePermission(P.ID_CARDS_MANAGE, P.SETTINGS_MANAGE), validate(v.cardSettingsSchema), c.patchSettings);
idCardRoutes.get("/stats", idRead, c.idStats);
idCardRoutes.get("/students", idRead, validate(v.idCardListSchema), c.idList);
idCardRoutes.post("/data", idRead, validate(v.idCardDataSchema), c.idData);
idCardRoutes.post("/generate", idManage, validate(v.idCardGenerateSchema), c.idGenerate);

export const examScheduleRoutes = Router();
examScheduleRoutes.use(requireAuth);
// Student Portal (fixed paths before "/:id").
examScheduleRoutes.get("/me", requirePermission(P.ADMIT_CARDS_READ_OWN), c.myExams);
examScheduleRoutes.get("/me/:examId/admit-card", requirePermission(P.ADMIT_CARDS_READ_OWN), validate(v.examIdParamSchema), c.myAdmit);
examScheduleRoutes.get("/overview", examRead, c.examOverview);
examScheduleRoutes.get("/", examRead, validate(v.listExamsSchema), c.examList);
examScheduleRoutes.post("/", examManage, validate(v.createExamSchema), c.examCreate);
examScheduleRoutes.get("/:id", examRead, validate(v.idParamSchema), c.examGet);
examScheduleRoutes.patch("/:id", examManage, validate(v.updateExamSchema), c.examUpdate);
examScheduleRoutes.post("/:id/status", examManage, validate(v.examStatusSchema), c.examStatus);
examScheduleRoutes.delete("/:id", examManage, validate(v.idParamSchema), c.examDelete);
examScheduleRoutes.get("/:id/eligible", examManage, validate(v.eligibleSchema), c.examEligible);
examScheduleRoutes.get("/:id/assignments", examRead, validate(v.assignmentsSchema), c.examAssignments);
examScheduleRoutes.post("/:id/assignments", examManage, validate(v.assignSchema), c.examAssign);
examScheduleRoutes.post("/:id/assignments/remove", examManage, validate(v.unassignSchema), c.examUnassign);
examScheduleRoutes.post("/:id/admit-cards/generate", examManage, validate(v.generateAdmitsSchema), c.admitGenerate);
examScheduleRoutes.post("/:id/admit-cards/data", examRead, validate(v.admitDataSchema), c.admitData);

/** QR verification — no login, rate-limited, returns only what is needed to compare the card with its holder. */
export const cardVerifyRoutes = Router();
cardVerifyRoutes.get("/id-card/:code", publicResultLimiter, validate(v.codeParamSchema), c.verifyId);
cardVerifyRoutes.get("/admit-card/:code", publicResultLimiter, validate(v.codeParamSchema), c.verifyAdmit);
