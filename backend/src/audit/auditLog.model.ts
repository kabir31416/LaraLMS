import { Schema, model, Types } from "mongoose";

export interface AuditLogDoc {
  actorUserId?: Types.ObjectId;
  actorRole?: string;
  action: string;
  module: string;
  targetCollection?: string;
  targetId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  timestamp: Date;
}

const auditLogSchema = new Schema<AuditLogDoc>({
  actorUserId: { type: Schema.Types.ObjectId, ref: "User" },
  actorRole: String,
  action: { type: String, required: true },
  module: { type: String, required: true },
  targetCollection: String,
  targetId: String,
  before: Schema.Types.Mixed,
  after: Schema.Types.Mixed,
  ip: String,
  userAgent: String,
  requestId: String,
  timestamp: { type: Date, default: Date.now },
});

auditLogSchema.index({ targetCollection: 1, targetId: 1 });
auditLogSchema.index({ actorUserId: 1, timestamp: -1 });
// Public-search hits are audited too (Phase 1 §19) but are low-value after a while.
auditLogSchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 90, partialFilterExpression: { module: "public-info" } },
);

export const AuditLog = model<AuditLogDoc>("AuditLog", auditLogSchema);
