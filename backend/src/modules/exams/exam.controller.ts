import { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { sendSuccess } from "../../common/utils/apiResponse";
import * as examService from "./exam.service";

export const create = asyncHandler(async (req: Request, res: Response) => {
  const doc = await examService.create(req, req.body);
  sendSuccess(res, doc, 201);
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { items, meta } = await examService.list(req);
  sendSuccess(res, items, 200, meta);
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await examService.getById(req.params.id));
});

export const saveResults = asyncHandler(async (req: Request, res: Response) => {
  await examService.saveResults(req, req.params.id, req.body.items);
  sendSuccess(res, { saved: true });
});

export const listResults = asyncHandler(async (req: Request, res: Response) => {
  const { items, meta } = await examService.listResults(req);
  sendSuccess(res, items, 200, meta);
});
