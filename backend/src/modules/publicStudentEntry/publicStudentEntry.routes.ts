import { Router } from "express";
import { validate } from "../../common/middlewares/validate.middleware";
import { studentEntryVerifyLimiter } from "../../common/middlewares/rateLimit.middleware";
import { requireStudentEntryToken } from "../../common/middlewares/studentEntryAuth.middleware";
import { photoUpload } from "../../common/middlewares/imageUpload.middleware";
import { updatePublicProfileSchema, verifyStudentEntrySchema } from "./publicStudentEntry.validation";
import * as controller from "./publicStudentEntry.controller";

/**
 * The public Student Entry workflow (Student Photo Management §10-§15) — no
 * `requireAuth` anywhere in this router, same as publicInfo.routes.ts, but
 * every route past /verify requires its OWN short-lived token
 * (requireStudentEntryToken) instead of being wide open. That token is the
 * only thing identifying "which student" — never a client-supplied ID
 * anywhere in this router.
 */
const router = Router();

router.post("/verify", studentEntryVerifyLimiter, validate(verifyStudentEntrySchema), controller.verify);
router.get("/profile", requireStudentEntryToken, controller.getProfile);
router.patch("/profile", requireStudentEntryToken, validate(updatePublicProfileSchema), controller.updateProfile);
router.post("/photo", requireStudentEntryToken, photoUpload.single("photo"), controller.uploadPhoto);

export default router;
