import { Request } from "express";
import { Types } from "mongoose";
import { ApiError } from "../../common/utils/ApiError";
import { PERMISSIONS } from "../rbac/permissions";
import { Mess } from "./models/mess.model";

/**
 * Mess-level data scope — the "on which records" half of authorization
 * (requirePermission in the routes answers "may this role do this at all").
 *
 *  - "*" (Admin) or MESS_ALL_ACCESS → every Mess (`null` = unrestricted)
 *  - a staff login (req.user.staffId) → only Messes listing that staff
 *    member in Mess.staff[] — the same assignment-list approach Batch
 *    Directors use (Batch.directorIds)
 *  - anyone else → no Mess at all
 *
 * Every Mess service list/read/write passes through this, so hiding a nav
 * item is never the only thing stopping a Mess Manager from reading another
 * Mess's data.
 */
export function hasPerm(req: Request, permission: string): boolean {
  const perms = req.user?.permissions ?? [];
  return perms.includes("*") || perms.includes(permission);
}

export async function accessibleMessIds(req: Request): Promise<Types.ObjectId[] | null> {
  if (!req.user) throw ApiError.unauthorized();
  if (hasPerm(req, PERMISSIONS.MESS_ALL_ACCESS)) return null;
  if (!req.user.staffId || !Types.ObjectId.isValid(req.user.staffId)) return [];
  const ids = await Mess.find({ "staff.staffId": new Types.ObjectId(req.user.staffId) }).distinct("_id");
  return ids as Types.ObjectId[];
}

export async function assertMessAccess(req: Request, messId: string | Types.ObjectId): Promise<void> {
  const ids = await accessibleMessIds(req);
  if (ids === null) return;
  if (!ids.some((id) => String(id) === String(messId))) {
    throw ApiError.forbidden("এই মেসের তথ্য দেখার/পরিবর্তনের অনুমতি আপনার নেই");
  }
}

/**
 * Builds the `messId` part of a Mongo filter: honours an explicitly requested
 * Mess (after checking access), otherwise restricts to every accessible Mess.
 * Returns `undefined` when no restriction is needed at all.
 */
export async function messScopeFilter(req: Request, requestedMessId?: unknown): Promise<Types.ObjectId | { $in: Types.ObjectId[] } | undefined> {
  if (typeof requestedMessId === "string" && requestedMessId) {
    if (!Types.ObjectId.isValid(requestedMessId)) throw ApiError.badRequest("Invalid messId");
    await assertMessAccess(req, requestedMessId);
    return new Types.ObjectId(requestedMessId);
  }
  const ids = await accessibleMessIds(req);
  if (ids === null) return undefined;
  return { $in: ids };
}
