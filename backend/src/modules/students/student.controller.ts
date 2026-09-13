import { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { sendSuccess } from "../../common/utils/apiResponse";
import { ApiError } from "../../common/utils/ApiError";
import { PERMISSIONS } from "../rbac/permissions";
import * as service from "./student.service";

/**
 * The route only gates on "does the caller hold STUDENTS_READ *or*
 * STUDENTS_READ_OWN_BATCH" — it doesn't say which rows a
 * STUDENTS_READ_OWN_BATCH-only caller (a Batch Director) may actually see.
 * Left unscoped here, GET /students returned every student in the coaching
 * centre to a Director, same as an Admin — the existing Director pages
 * happened to re-filter client-side, which hid the leak in the UI but not
 * from the network response, and silently broke once a centre had more
 * students than one page (the director's own batch could get pushed off
 * page 1 entirely). Force the same directorId scope the `list` service
 * already supports as an explicit query filter, exactly like
 * payment.controller.ts's hasBroadReadAccess does for payments.
 */
function hasBroadReadAccess(req: Request): boolean {
  const perms = req.user!.permissions;
  return perms.includes("*") || perms.includes(PERMISSIONS.STUDENTS_READ);
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  if (!hasBroadReadAccess(req)) {
    if (!req.user!.staffId) throw ApiError.forbidden("No linked staff record");
    req.query.directorId = req.user!.staffId;
  }
  const { items, meta } = await service.list(req);
  sendSuccess(res, items, 200, meta);
});

export const getById = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.getById(req.params.id)));

export const getMyProfile = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.getMyProfile(req)));

export const quickCreate = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.quickCreate(req, req.body), 201));

export const create = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.create(req, req.body), 201));

export const update = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.update(req, req.params.id, req.body)));

export const updateSelf = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.updateSelf(req, req.params.id, req.body)));

export const updateRoll = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.updateRoll(req, req.params.id, req.body.rollNumber)));

export const updateStatus = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.updateStatus(req, req.params.id, req.body.status)));

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await service.remove(req, req.params.id);
  sendSuccess(res, { deleted: true });
});
