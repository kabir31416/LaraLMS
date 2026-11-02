import { Types } from "mongoose";
import { ApiError } from "../../common/utils/ApiError";
import { localToday } from "../../common/utils/localDate";
import { MembershipStatus, OPEN_MEMBERSHIP_STATUS, SEAT_HOLDING_STATUS } from "./mess.constants";

export function isDuplicateKeyError(err: unknown): boolean {
  return !!err && typeof err === "object" && (err as { code?: number }).code === 11000;
}

/** Money is kept to 2 decimals everywhere so repeated sums never drift by floating-point dust. */
export function money(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** Calendar date "yyyy-mm-dd" in the institution's timezone (APP_TIMEZONE) — the same plain-string date convention the rest of the ERP stores. */
export function todayISO(): string {
  return localToday();
}

export function currentPeriod(): string {
  return todayISO().slice(0, 7);
}

export function daysInPeriod(period: string): number {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export function periodDate(period: string, day: number): string {
  const d = Math.min(Math.max(1, day), daysInPeriod(period));
  return `${period}-${String(d).padStart(2, "0")}`;
}

export function addDaysISO(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** The two index-backing flags a membership's status implies — always written together with the status itself. */
export function statusFlags(status: MembershipStatus): { isOpen: boolean; holdsSeat: boolean } {
  return { isOpen: OPEN_MEMBERSHIP_STATUS.includes(status), holdsSeat: SEAT_HOLDING_STATUS.includes(status) };
}

export function toObjectId(id: string | Types.ObjectId, label = "id"): Types.ObjectId {
  if (id instanceof Types.ObjectId) return id;
  if (!Types.ObjectId.isValid(id)) throw ApiError.badRequest(`Invalid ${label}`);
  return new Types.ObjectId(id);
}

export function nameKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function actorId(req: { user?: { id?: string } }): Types.ObjectId | undefined {
  const id = req.user?.id;
  return id && Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : undefined;
}
