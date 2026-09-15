import { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { sendSuccess } from "../../common/utils/apiResponse";
import { ApiError } from "../../common/utils/ApiError";
import * as service from "./admissionResult.service";

export const uploadAndPreview = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.badRequest("PDF ফাইল আবশ্যক।");
  const result = await service.uploadAndPreview(req, req.file, req.body);
  sendSuccess(res, result, 201);
});

export const confirmImport = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.confirmImport(req, req.params.importId)));

export const cancelImport = asyncHandler(async (req: Request, res: Response) => {
  await service.cancelImport(req, req.params.importId);
  sendSuccess(res, { cancelled: true });
});

export const rollbackImport = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.rollbackImport(req, req.params.importId)));

export const listChanceStudents = asyncHandler(async (req: Request, res: Response) => {
  const { items, meta } = await service.listChanceStudents(req);
  sendSuccess(res, items, 200, meta);
});

export const getStats = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.getStats(req)));

export const getInstitutesSummary = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.getInstitutesSummary(req)));

export const getBatchesSummary = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.getBatchesSummary(req)));

export const getInstituteOptions = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.getInstituteOptions(req)));

export const getFilterOptions = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.getFilterOptions(req)));

export const getStudentHistory = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.getStudentHistory(req, req.params.studentId)));

export const listImportHistory = asyncHandler(async (req: Request, res: Response) => {
  const { items, meta } = await service.listImportHistory(req);
  sendSuccess(res, items, 200, meta);
});

export const getImportDetail = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.getImportDetail(req, req.params.id)));

export const matchUnmatchedRoll = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, await service.matchUnmatchedRoll(req, req.params.importId, Number(req.params.index), req.body.studentId), 201),
);
