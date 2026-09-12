import { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { sendSuccess } from "../../common/utils/apiResponse";
import * as branchLedgerService from "./branchLedger.service";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { items, meta } = await branchLedgerService.list(req);
  sendSuccess(res, items, 200, meta);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await branchLedgerService.create(req, req.body), 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await branchLedgerService.update(req, req.params.id, req.body));
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await branchLedgerService.remove(req, req.params.id);
  sendSuccess(res, { deleted: true });
});

export const summary = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await branchLedgerService.summary());
});
