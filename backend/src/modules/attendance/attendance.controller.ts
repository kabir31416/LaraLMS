import { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { sendSuccess } from "../../common/utils/apiResponse";
import * as attendanceService from "./attendance.service";

export const save = asyncHandler(async (req: Request, res: Response) => {
  await attendanceService.save(req, req.body);
  sendSuccess(res, { saved: true });
});

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { items, meta } = await attendanceService.list(req);
  sendSuccess(res, items, 200, meta);
});

export const byStudent = asyncHandler(async (req: Request, res: Response) => {
  const data = await attendanceService.byStudent(req, {
    batchId: req.query.batchId as string | undefined,
    dateFrom: req.query.dateFrom as string | undefined,
    dateTo: req.query.dateTo as string | undefined,
  });
  sendSuccess(res, data);
});

export const stats = asyncHandler(async (req: Request, res: Response) => {
  const batchIds = typeof req.query.batchIds === "string" ? req.query.batchIds.split(",").filter(Boolean) : undefined;
  const data = await attendanceService.stats(req, {
    batchId: req.query.batchId as string | undefined,
    batchIds,
    dateFrom: req.query.dateFrom as string | undefined,
    dateTo: req.query.dateTo as string | undefined,
  });
  sendSuccess(res, data);
});

export const percentages = asyncHandler(async (req: Request, res: Response) => {
  const studentIds = typeof req.query.studentIds === "string" ? req.query.studentIds.split(",").filter(Boolean) : undefined;
  const batchIds = typeof req.query.batchIds === "string" ? req.query.batchIds.split(",").filter(Boolean) : undefined;
  const data = await attendanceService.percentages(req, {
    studentIds,
    batchId: req.query.batchId as string | undefined,
    batchIds,
    dateFrom: req.query.dateFrom as string | undefined,
    dateTo: req.query.dateTo as string | undefined,
  });
  sendSuccess(res, data);
});
