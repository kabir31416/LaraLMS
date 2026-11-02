import { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { sendSuccess } from "../../common/utils/apiResponse";
import { ApiError } from "../../common/utils/ApiError";
import * as dashboardService from "./dashboard.service";
import * as overviewService from "./dashboardOverview.service";

export const adminSummary = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await dashboardService.getAdminSummary());
});

export const admissionSummary = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await dashboardService.getAdmissionSummary());
});

export const directorSummary = asyncHandler(async (req: Request, res: Response) => {
  const staffId = req.user?.staffId;
  if (!staffId) throw ApiError.forbidden("This account has no linked Batch Director record");
  sendSuccess(res, await dashboardService.getDirectorSummary(staffId));
});

/** Main Dashboard command center — permission-aware sections, date range + course/batch filters. */
export const adminOverview = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  sendSuccess(res, await overviewService.getAdminOverview(req, { from: q.from, to: q.to, courseId: q.courseId, batchId: q.batchId }));
});
