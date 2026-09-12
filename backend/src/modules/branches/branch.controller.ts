import { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { sendSuccess } from "../../common/utils/apiResponse";
import * as branchService from "./branch.service";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { items, meta } = await branchService.list(req);
  sendSuccess(res, items, 200, meta);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await branchService.getById(req.params.id));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await branchService.create(req, req.body), 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await branchService.update(req, req.params.id, req.body));
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await branchService.remove(req, req.params.id);
  sendSuccess(res, { deleted: true });
});
