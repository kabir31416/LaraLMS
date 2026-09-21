import { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { sendSuccess } from "../../common/utils/apiResponse";
import { ApiError } from "../../common/utils/ApiError";
import * as service from "./publicStudentEntry.service";
import * as hscInstitutionService from "../hscInstitutions/hscInstitution.service";

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

/**
 * HSC Institution Autocomplete audit §4 — reuses hscInstitution.service.ts's
 * own `list()` verbatim (same master-data collection GET /hsc-institutions
 * already uses for Admin/Portal), just gated by requireStudentEntryToken
 * instead of requireAuth so /studententry's own short-lived token can reach
 * it. No parallel institution-search logic; writes still only ever happen
 * through student.service.ts's syncHscInstitution() at actual save time.
 */
export const listHscInstitutions = asyncHandler(async (req: Request, res: Response) => {
  const { items, meta } = await hscInstitutionService.list(req);
  sendSuccess(res, items, 200, meta);
});
