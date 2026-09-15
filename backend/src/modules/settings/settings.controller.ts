import { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { sendSuccess } from "../../common/utils/apiResponse";
import * as settingsService from "./settings.service";
import * as institutionService from "./institution.service";

export const getSettings = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await settingsService.getSettings());
});

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await settingsService.updateSettings(req, req.body));
});

export const getPublicInfoSettings = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await settingsService.getPublicInfoSettings());
});

export const updatePublicInfoSettings = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await settingsService.updatePublicInfoSettings(req, req.body));
});

export const getPublicResultsSettings = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await settingsService.getPublicResultsSettings());
});

export const updatePublicResultsSettings = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await settingsService.updatePublicResultsSettings(req, req.body));
});

export const getInstitutionSettings = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await institutionService.getInstitutionSettings());
});

export const updateInstitutionSettings = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await institutionService.updateInstitutionSettings(req, req.body));
});
