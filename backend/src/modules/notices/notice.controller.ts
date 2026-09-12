import { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { sendSuccess } from "../../common/utils/apiResponse";
import * as noticeService from "./notice.service";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { items, meta } = await noticeService.list(req);
  sendSuccess(res, items, 200, meta);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await noticeService.create(req, req.body), 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await noticeService.update(req, req.params.id, req.body));
});

export const togglePin = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await noticeService.togglePin(req, req.params.id));
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await noticeService.remove(req, req.params.id);
  sendSuccess(res, { deleted: true });
});
