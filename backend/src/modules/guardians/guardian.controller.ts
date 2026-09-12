import { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { sendSuccess } from "../../common/utils/apiResponse";
import * as service from "./guardian.service";

export const listByStudent = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.listByStudent(req.params.studentId));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.create(req, req.params.studentId, req.body), 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.update(req, req.params.id, req.body));
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await service.remove(req, req.params.id);
  sendSuccess(res, { deleted: true });
});
