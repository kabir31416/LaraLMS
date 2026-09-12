import { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { sendSuccess } from "../../common/utils/apiResponse";
import { ApiError } from "../../common/utils/ApiError";
import * as dashboardService from "./dashboard.service";

export const adminSummary = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await dashboardService.getAdminSummary());
});

export const directorSummary = asyncHandler(async (req: Request, res: Response) => {
  const staffId = req.user?.staffId;
  if (!staffId) throw ApiError.forbidden("This account has no linked Batch Director record");
  sendSuccess(res, await dashboardService.getDirectorSummary(staffId));
});
