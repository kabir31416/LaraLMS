import { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { sendSuccess } from "../../common/utils/apiResponse";
import * as service from "./publicNewStudentEntry.service";

export const listCourses = asyncHandler(async (_req: Request, res: Response) =>
  sendSuccess(res, await service.listActiveCourses()),
);

export const register = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(
    res,
    await service.register(req, {
      name: req.body.name,
      rollNumber: req.body.rollNumber,
      phone: req.body.phone,
      guardianMobile: req.body.guardianMobile,
      courseId: req.body.courseId,
    }),
    201,
  ),
);
