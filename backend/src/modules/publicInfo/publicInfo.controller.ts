import { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { sendSuccess } from "../../common/utils/apiResponse";
import * as service from "./publicInfo.service";

export const search = asyncHandler(async (req: Request, res: Response) => {
  const { method, q } = req.query as unknown as { method: "registrationId" | "phone" | "name"; q: string };
  sendSuccess(res, await service.search(method, q));
});
