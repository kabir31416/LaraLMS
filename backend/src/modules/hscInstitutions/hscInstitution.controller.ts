import { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { sendSuccess } from "../../common/utils/apiResponse";
import * as service from "./hscInstitution.service";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { items, meta } = await service.list(req);
  sendSuccess(res, items, 200, meta);
});
