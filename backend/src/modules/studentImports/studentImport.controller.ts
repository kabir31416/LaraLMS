import { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { sendSuccess } from "../../common/utils/apiResponse";
import { ApiError } from "../../common/utils/ApiError";
import * as service from "./studentImport.service";

export const upload = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.badRequest("এক্সেল ফাইল আবশ্যক।");
  // Course is mandatory and selected via the UI BEFORE upload (Excel Student
  // Information Import §2) — enforced here, not just on the frontend, since
  // the Excel file itself deliberately carries no Course column at all.
  const courseId = typeof req.body.courseId === "string" ? req.body.courseId.trim() : "";
  if (!courseId) throw ApiError.badRequest("আমদানি করার আগে একটি কোর্স নির্বাচন করুন।");
  sendSuccess(res, await service.uploadAndPreview(req, req.file, courseId), 201);
});

export const downloadTemplate = asyncHandler(async (_req: Request, res: Response) => {
  const buffer = service.generateTemplate();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="student-import-template.xlsx"');
  res.send(buffer);
});

export const getSession = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.getSession(req.params.sessionId)));

export const listRows = asyncHandler(async (req: Request, res: Response) => {
  const { items, meta } = await service.listRows(req, req.params.sessionId);
  sendSuccess(res, items, 200, meta);
});

export const listHistory = asyncHandler(async (req: Request, res: Response) => {
  const { items, meta } = await service.listHistory(req);
  sendSuccess(res, items, 200, meta);
});

export const approveRow = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, await service.approveRow(req, req.params.sessionId, req.params.rowId)),
);

export const rejectRow = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, await service.rejectRow(req, req.params.sessionId, req.params.rowId, req.body.reason)),
);

export const bulkApprove = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, await service.bulkApproveRows(req, req.params.sessionId, req.body.rowIds)),
);

export const listValidRowIds = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, await service.listValidRowIds(req.params.sessionId)),
);
