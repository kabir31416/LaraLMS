import { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { sendSuccess } from "../../common/utils/apiResponse";
import * as service from "./resultManagement.service";

export const listStudentResults = asyncHandler(async (req: Request, res: Response) => {
  const { batchId, search, page, limit } = req.query as Record<string, string | undefined>;
  const { items, meta } = await service.listStudentResults(req, { batchId, search, page, limit });
  sendSuccess(res, items, 200, meta);
});

export const getTopStudents = asyncHandler(async (req: Request, res: Response) => {
  const { batchId, limit } = req.query as Record<string, string | undefined>;
  sendSuccess(res, await service.getTopStudents(req, { batchId, limit: limit ? Number(limit) : undefined }));
});

export const getStudentResult = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.getStudentResultDetail(req, req.params.studentId));
});

export const getBatchResults = asyncHandler(async (req: Request, res: Response) => {
  const { batchId, subjectId, lectureId, examId } = req.query as Record<string, string | undefined>;
  sendSuccess(res, await service.getBatchResults(req, { batchId: batchId!, subjectId, lectureId, examId }));
});

export const updateResultMark = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.updateResultMark(req, req.params.resultId, req.body.marks));
});

export const listResultRecords = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, ...filter } = req.query as Record<string, string | undefined>;
  const { items, meta } = await service.listResultRecords(req, filter, { page, limit });
  sendSuccess(res, items, 200, meta);
});

export const previewDeleteResultRecords = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.previewDeleteResultRecords(req, req.body));
});

export const deleteResultRecordsBulk = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.deleteResultRecordsBulk(req, req.body));
});

export const deleteOneResult = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.deleteOneResult(req, req.params.resultId));
});

export const deleteSelectedResults = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.deleteSelectedResults(req, req.body.resultIds));
});
