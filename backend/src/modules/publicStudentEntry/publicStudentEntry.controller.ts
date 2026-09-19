import { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { sendSuccess } from "../../common/utils/apiResponse";
import { ApiError } from "../../common/utils/ApiError";
import * as service from "./publicStudentEntry.service";

export const verify = asyncHandler(async (req: Request, res: Response) => {
  const { identifier, phone } = req.body as { identifier: string; phone: string };
  sendSuccess(res, await service.verify(identifier, phone));
});

export const getProfile = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.getProfile(req.studentEntryId!)));

export const updateProfile = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, await service.updateProfile(req, req.studentEntryId!, req.body)),
);

export const uploadPhoto = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file?.buffer) throw ApiError.badRequest("কোনো ছবি পাওয়া যায়নি — আবার চেষ্টা করুন।");
  sendSuccess(res, await service.uploadPhoto(req, req.studentEntryId!, req.file.buffer));
});
