import { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { sendSuccess } from "../../common/utils/apiResponse";
import * as bookService from "./book.service";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { items, meta } = await bookService.list(req);
  sendSuccess(res, items, 200, meta);
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await bookService.create(req, req.body), 201);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await bookService.update(req, req.params.id, req.body));
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await bookService.remove(req, req.params.id);
  sendSuccess(res, { deleted: true });
});

export const adjustStock = asyncHandler(async (req: Request, res: Response) => {
  const { action, quantity, note } = req.body;
  sendSuccess(res, await bookService.adjustStock(req, req.params.id, action, quantity, note));
});

export const listBranchStock = asyncHandler(async (req: Request, res: Response) => {
  const { items, meta } = await bookService.listBranchStock(req);
  sendSuccess(res, items, 200, meta);
});

export const transferToBranch = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await bookService.transferToBranch(req, req.body.branchId, req.body.items));
});

export const issueToStudent = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await bookService.issueToStudent(req, req.body.studentId, req.body.issueDate, req.body.items), 201);
});

export const listIssues = asyncHandler(async (req: Request, res: Response) => {
  const { items, meta } = await bookService.listIssues(req);
  sendSuccess(res, items, 200, meta);
});

export const returnFromStudent = asyncHandler(async (req: Request, res: Response) => {
  await bookService.returnFromStudent(req, req.params.id, req.body.quantity);
  sendSuccess(res, { returned: true });
});

export const listHistory = asyncHandler(async (req: Request, res: Response) => {
  const { items, meta } = await bookService.listHistory(req);
  sendSuccess(res, items, 200, meta);
});
