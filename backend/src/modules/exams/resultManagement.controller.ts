import { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { sendSuccess } from "../../common/utils/apiResponse";
import * as service from "./resultManagement.service";

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
