import { Router } from "express";
import { validate } from "../../common/middlewares/validate.middleware";
import { publicNewStudentEntryLimiter } from "../../common/middlewares/rateLimit.middleware";
import { photoUpload } from "../../common/middlewares/imageUpload.middleware";
import { listBatchesQuerySchema, registerNewStudentSchema } from "./publicNewStudentEntry.validation";
import * as controller from "./publicNewStudentEntry.controller";

/**
 * The public /newstudententry quick-admission form — no `requireAuth`
 * anywhere in this router, same as publicInfo.routes.ts/publicStudentEntry.
 * routes.ts. Unlike publicStudentEntry (which identifies an EXISTING
 * student via a short-lived verify token), this router creates a brand new
 * (pending) Student — validate() + the explicit registerNewStudentSchema are
 * the only things standing between the request body and student.service.ts's
 * create(), so nothing beyond the named fields can ever reach it.
 *
 * photoUpload.single("photo") runs BEFORE validate() so multer has already
 * populated req.body's text fields from the multipart request by the time
 * Zod inspects them — the same ordering /studententry's own photo route
 * uses. The photo itself is OPTIONAL (Student Entry Workflow §3): multer
 * only rejects a file that IS present and invalid, never a missing one.
 */
const router = Router();

// Course list for the form's dropdown — no rate limit, same as
// publicInfo.routes.ts's /institution: non-sensitive, no per-visitor
// enumeration risk, just the active-course names every visitor sees anyway.
router.get("/courses", controller.listCourses);
// Course-scoped Batch dropdown (Student Entry Workflow §4) — same non-sensitive reasoning as /courses.
router.get("/batches", validate(listBatchesQuerySchema), controller.listBatches);
router.post("/", publicNewStudentEntryLimiter, photoUpload.single("photo"), validate(registerNewStudentSchema), controller.register);

export default router;
