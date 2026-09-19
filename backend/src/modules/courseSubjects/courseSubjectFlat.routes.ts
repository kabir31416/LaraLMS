import { Router } from "express";
import { Request, Response } from "express";
import { requireAuth } from "../../common/middlewares/auth.middleware";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { sendSuccess } from "../../common/utils/apiResponse";
import { getDirectorCourseIds } from "../courses/course.service";
import * as service from "./courseSubject.service";

// Flat, unscoped-by-path listing — mounted at /course-subjects (routes/index.ts)
// alongside the /courses/:courseId/subjects nested CRUD router. One query for
// every CourseSubject across every Course, exactly like the already-flat
// /subjects and /lectures lists — avoids the frontend having to issue one
// request per Course just to build its Course→Subject picture.
const router = Router();

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const scopeCourseIds =
      req.user?.role === "batch_director" && req.user.staffId ? await getDirectorCourseIds(req.user.staffId) : undefined;
    sendSuccess(res, await service.listAll(scopeCourseIds));
  }),
);

export default router;
