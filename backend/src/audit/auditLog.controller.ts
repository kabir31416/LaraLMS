import { Request, Response } from "express";
import { asyncHandler } from "../common/utils/asyncHandler";
import { sendSuccess } from "../common/utils/apiResponse";
import * as service from "./auditLog.service";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { items, meta } = await service.listAuditLogs(req);
  sendSuccess(res, items, 200, meta);
});
