import { Request } from "express";
import { AuditLog } from "./auditLog.model";
import { logger } from "../logger/logger";

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
