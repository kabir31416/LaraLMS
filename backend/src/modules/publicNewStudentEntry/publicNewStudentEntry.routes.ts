import { Router } from "express";
import { validate } from "../../common/middlewares/validate.middleware";
import { publicNewStudentEntryLimiter } from "../../common/middlewares/rateLimit.middleware";
import { registerNewStudentSchema } from "./publicNewStudentEntry.validation";
import * as controller from "./publicNewStudentEntry.controller";

/**
 * The public /newstudententry quick-admission form — no `requireAuth`
 * anywhere in this router, same as publicInfo.routes.ts/publicStudentEntry.
 * routes.ts. Unlike publicStudentEntry (which identifies an EXISTING
 * student via a short-lived verify token), this router creates a brand new
 * Student — validate() + the explicit registerNewStudentSchema are the only
 * things standing between the request body and student.service.ts's
 * create(), so nothing beyond the 5 named fields can ever reach it.
 */
const router = Router();

// Course list for the form's dropdown — no rate limit, same as
// publicInfo.routes.ts's /institution: non-sensitive, no per-visitor
// enumeration risk, just the active-course names every visitor sees anyway.
router.get("/courses", controller.listCourses);
router.post("/", publicNewStudentEntryLimiter, validate(registerNewStudentSchema), controller.register);

export default router;
