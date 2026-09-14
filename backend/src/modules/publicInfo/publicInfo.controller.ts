import { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { sendSuccess } from "../../common/utils/apiResponse";
import * as service from "./publicInfo.service";
import * as institutionService from "../settings/institution.service";

export const search = asyncHandler(async (req: Request, res: Response) => {
  const { method, q } = req.query as unknown as { method: "registrationId" | "phone" | "name"; q: string };
  sendSuccess(res, await service.search(method, q));
});

/** Institution branding for the public /info and /marksheet pages (Settings §2) — a safe allowlisted subset, never the admin-only fields. */
export const getInstitution = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await institutionService.getPublicInstitutionInfo());
});
