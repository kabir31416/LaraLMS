import { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { sendSuccess } from "../../common/utils/apiResponse";
import * as accountsService from "./accounts.service";

export const listIncome = asyncHandler(async (req: Request, res: Response) => {
  const { items, meta } = await accountsService.listIncome(req);
  sendSuccess(res, items, 200, meta);
});

export const createIncome = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await accountsService.createIncome(req, req.body), 201);
});

export const updateIncome = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await accountsService.updateIncome(req, req.params.id, req.body));
});

export const deleteIncome = asyncHandler(async (req: Request, res: Response) => {
  await accountsService.deleteIncome(req, req.params.id);
  sendSuccess(res, { deleted: true });
});

export const listExpense = asyncHandler(async (req: Request, res: Response) => {
  const { items, meta } = await accountsService.listExpense(req);
  sendSuccess(res, items, 200, meta);
});

export const createExpense = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await accountsService.createExpense(req, req.body), 201);
});

export const updateExpense = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await accountsService.updateExpense(req, req.params.id, req.body));
});

export const deleteExpense = asyncHandler(async (req: Request, res: Response) => {
  await accountsService.deleteExpense(req, req.params.id);
  sendSuccess(res, { deleted: true });
});

export const getCategories = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await accountsService.getCategories());
});

export const updateCategories = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await accountsService.updateCategories(req, req.body));
});
