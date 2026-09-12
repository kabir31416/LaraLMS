import { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { sendSuccess } from "../../common/utils/apiResponse";
import * as service from "./enrollment.service";

export const listByStudent = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.listByStudent(req.params.id));
});

export const enroll = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.enrollStudent(req, req.params.id, req.body.batchId), 201);
});

export const transfer = asyncHandler(async (req: Request, res: Response) => {
  const { toBatchId, reason, newRollNumber } = req.body;
  sendSuccess(res, await service.transferStudent(req, req.params.id, toBatchId, reason, newRollNumber));
});

export const withdraw = asyncHandler(async (req: Request, res: Response) => {
  await service.withdrawStudent(req, req.params.id, req.body.reason);
  sendSuccess(res, { withdrawn: true });
});

export const getRoster = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.getRoster(req.params.id));
});

export const enrollBulk = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.enrollBulk(req, req.params.id, req.body.studentIds));
});
