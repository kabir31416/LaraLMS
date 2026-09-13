import { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { sendSuccess } from "../../common/utils/apiResponse";
import * as service from "./publicResults.service";

export const getIndividualResult = asyncHandler(async (req: Request, res: Response) => {
  const { roll, startDate, endDate } = req.query as unknown as { roll: string; startDate: string; endDate: string };
  sendSuccess(res, await service.getIndividualResult(roll, startDate, endDate));
});

export const listBatches = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.listPublicBatches(req.query.courseId as string | undefined));
});

export const getBatchMasterSheet = asyncHandler(async (req: Request, res: Response) => {
  const { batchName, startDate, endDate } = req.query as unknown as { batchName: string; startDate?: string; endDate?: string };
  sendSuccess(res, await service.getBatchMasterSheet(batchName, startDate, endDate));
});
