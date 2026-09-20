import { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { sendSuccess } from "../../common/utils/apiResponse";
import * as service from "./courseSubject.service";
import { getDirectorCourseIds } from "../courses/course.service";

/** Same "Batch Director only sees their own course(s)" scoping every level of Course→Subject→Lecture already applies (Phase 4 §7/§8). */
async function directorScope(req: Request): Promise<string[] | undefined> {
  if (req.user?.role !== "batch_director" || !req.user.staffId) return undefined;
  return getDirectorCourseIds(req.user.staffId);
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.listForCourse(req.params.courseId, await directorScope(req)));
});

export const assign = asyncHandler(async (req: Request, res: Response) => {
  const doc = await service.assign(req, req.params.courseId, req.body, await directorScope(req));
  sendSuccess(res, doc, 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.update(req, req.params.courseSubjectId, req.body, await directorScope(req)));
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await service.remove(req, req.params.courseSubjectId, await directorScope(req));
  sendSuccess(res, { deleted: true });
});
