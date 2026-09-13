import { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { sendSuccess } from "../../common/utils/apiResponse";
import * as service from "./course.service";

/** A Batch Director only ever sees the course(s) tied to batch(es) they actually direct — Phase 4 §7/§8. Everyone else (Admin, Student) is unscoped. */
async function directorScope(req: Request): Promise<string[] | undefined> {
  if (req.user?.role !== "batch_director" || !req.user.staffId) return undefined;
  return service.getDirectorCourseIds(req.user.staffId);
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { items, meta } = await service.list(req, await directorScope(req));
  sendSuccess(res, items, 200, meta);
});
export const getById = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.getById(req.params.id, await directorScope(req))));
export const create = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.create(req, req.body), 201));
export const update = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.update(req, req.params.id, req.body)));
export const remove = asyncHandler(async (req: Request, res: Response) => {
  await service.remove(req, req.params.id);
  sendSuccess(res, { deleted: true });
});
