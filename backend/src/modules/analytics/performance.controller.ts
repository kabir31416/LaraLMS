import { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { sendSuccess } from "../../common/utils/apiResponse";
import * as service from "./performance.service";

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const num = (v: unknown) => (v === undefined || v === "" ? undefined : Number(v));

export const performance = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query;
  const data = await service.getPerformance(
    req,
    {
      sessionId: str(q.sessionId), courseId: str(q.courseId), batchId: str(q.batchId), studentId: str(q.studentId), q: str(q.q),
      examId: str(q.examId), subjectId: str(q.subjectId), dateFrom: str(q.dateFrom), dateTo: str(q.dateTo),
      attendanceMin: num(q.attendanceMin), attendanceMax: num(q.attendanceMax), status: str(q.status),
    },
    { page: Number(q.page) || 1, limit: Number(q.limit) || 20, sort: str(q.sort), fresh: q.fresh === "1", exportAll: q.export === "1" },
  );
  const { items, meta, ...rest } = data;
  sendSuccess(res, { ...rest, items }, 200, meta);
});

export const options = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.getFilterOptions(req, { courseId: str(req.query.courseId), batchId: str(req.query.batchId) }));
});

export const studentProfile = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.getStudentPerformance(req, req.params.id, { dateFrom: str(req.query.dateFrom), dateTo: str(req.query.dateTo), subjectId: str(req.query.subjectId) }));
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.getMyPerformance(req, { dateFrom: str(req.query.dateFrom), dateTo: str(req.query.dateTo), subjectId: str(req.query.subjectId) }));
});
