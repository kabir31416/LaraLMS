import { Request } from "express";
import { AuditLog } from "./auditLog.model";
import { logger } from "../logger/logger";
import { buildMeta, parsePagination } from "../common/utils/pagination";

interface RecordAuditParams {
  req?: Request;
  action: string;
  module: string;
  targetCollection?: string;
  targetId?: string;
  before?: unknown;
  after?: unknown;
}

/**
 * Central write path for AuditLog — called from each module's *service* layer
 * after a successful mutation, never from the controller, so an entry is
 * guaranteed regardless of which route triggered the change (Phase 2 §17).
 * Never throws: a failed audit write must not fail the business operation it's recording.
 */
export async function recordAudit(params: RecordAuditParams): Promise<void> {
  try {
    await AuditLog.create({
      actorUserId: params.req?.user?.id,
      actorRole: params.req?.user?.role,
      action: params.action,
      module: params.module,
      targetCollection: params.targetCollection,
      targetId: params.targetId,
      before: params.before,
      after: params.after,
      ip: params.req?.ip,
      userAgent: params.req?.headers["user-agent"],
      requestId: params.req?.requestId,
    });
  } catch (err) {
    logger.error({ err, action: params.action }, "Failed to write audit log");
  }
}

/**
 * Read side for the Configuration History / Audit Log viewer (Settings §23).
 * Admin-only (AUDIT_READ, gated in auditLog.routes.ts) — `before`/`after`
 * can carry a full document snapshot, so this is never exposed to any role
 * that couldn't already see that data through its own module's normal read.
 */
export async function listAuditLogs(req: Request) {
  const { page, limit, skip, sort } = parsePagination(req, { timestamp: -1 });
  const filter: Record<string, unknown> = {};
  if (req.query.module) filter.module = req.query.module;
  if (req.query.action) filter.action = req.query.action;
  if (req.query.actorUserId) filter.actorUserId = req.query.actorUserId;
  if (req.query.dateFrom || req.query.dateTo) {
    filter.timestamp = {
      ...(req.query.dateFrom ? { $gte: new Date(String(req.query.dateFrom)) } : {}),
      ...(req.query.dateTo ? { $lte: new Date(String(req.query.dateTo)) } : {}),
    };
  }

  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort(sort).skip(skip).limit(limit),
    AuditLog.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}
