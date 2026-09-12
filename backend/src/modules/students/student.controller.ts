import { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { sendSuccess } from "../../common/utils/apiResponse";
import * as service from "./student.service";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { items, meta } = await service.list(req);
  sendSuccess(res, items, 200, meta);
});

export const getById = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.getById(req.params.id)));

export const getMyProfile = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.getMyProfile(req)));

export const quickCreate = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.quickCreate(req, req.body), 201));

export const create = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.create(req, req.body), 201));

export const update = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.update(req, req.params.id, req.body)));

export const updateSelf = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.updateSelf(req, req.params.id, req.body)));

export const updateRoll = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.updateRoll(req, req.params.id, req.body.rollNumber)));

export const updateStatus = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.updateStatus(req, req.params.id, req.body.status)));

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await service.remove(req, req.params.id);
  sendSuccess(res, { deleted: true });
});
