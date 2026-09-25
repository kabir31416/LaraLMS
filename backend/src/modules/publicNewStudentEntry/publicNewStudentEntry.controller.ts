import { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { sendSuccess } from "../../common/utils/apiResponse";
import * as service from "./publicNewStudentEntry.service";

export const listCourses = asyncHandler(async (_req: Request, res: Response) =>
  sendSuccess(res, await service.listActiveCourses()),
);

export const listBatches = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, await service.listBatchesForCourse(String(req.query.courseId))),
);

/** Photo is OPTIONAL here (Student Entry Workflow §3) — req.file is simply absent when the admin/staff submitted without one; multer's own fileFilter (imageUpload.middleware.ts) already rejected anything present but invalid before this ever runs. */
export const register = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    await service.register(req, {
      name: req.body.name,
      rollNumber: req.body.rollNumber,
      phone: req.body.phone,
      guardianMobile: req.body.guardianMobile,
      courseId: req.body.courseId,
      batchId: req.body.batchId,
      photoBuffer: req.file?.buffer,
    }),
    201,
  ),
);
