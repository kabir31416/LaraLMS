import { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { sendSuccess } from "../../common/utils/apiResponse";
import { ApiError } from "../../common/utils/ApiError";
import { PERMISSIONS } from "../rbac/permissions";
import * as paymentService from "./payment.service";

function hasBroadReadAccess(req: Request): boolean {
  const perms = req.user!.permissions;
  return perms.includes("*") || perms.includes(PERMISSIONS.PAYMENTS_READ);
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  if (!hasBroadReadAccess(req)) {
    // Caller only holds payments:read:own — force the scope to their own
    // record regardless of what studentId (if any) they asked for.
    if (!req.user!.studentId) throw ApiError.forbidden("No linked student record");
    req.query.studentId = req.user!.studentId;
  }
  const { items, meta } = await paymentService.list(req);
  sendSuccess(res, items, 200, meta);
});

export const stats = asyncHandler(async (req: Request, res: Response) => {
  if (!hasBroadReadAccess(req)) {
    if (!req.user!.studentId) throw ApiError.forbidden("No linked student record");
    req.query.studentId = req.user!.studentId;
  }
  sendSuccess(res, await paymentService.stats(req));
});

export const getById = asyncHandler(async (req: Request, res: Response) => {
  const doc = await paymentService.getById(req.params.id);
  if (!hasBroadReadAccess(req) && String(doc.studentId) !== req.user!.studentId) {
    throw ApiError.forbidden("You may only access your own payments");
  }
  sendSuccess(res, doc);
});

export const getReceipt = asyncHandler(async (req: Request, res: Response) => {
  const doc = await paymentService.getById(req.params.id);
  if (!hasBroadReadAccess(req) && String(doc.studentId) !== req.user!.studentId) {
    throw ApiError.forbidden("You may only access your own payments");
  }
  sendSuccess(res, await paymentService.getReceipt(doc));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const doc = await paymentService.create(req, req.body);
  sendSuccess(res, doc, 201);
});

export const cancel = asyncHandler(async (req: Request, res: Response) => {
  const doc = await paymentService.cancel(req, req.params.id, req.body?.reason);
  sendSuccess(res, doc);
});
