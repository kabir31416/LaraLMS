import { Schema, model, Document, Types } from "mongoose";
import { SMS_EVENT_TYPES, SMS_PROVIDERS, SmsEventType, SmsProviderName, DEFAULT_SMS_TEMPLATES } from "./sms.constants";

/**
 * SMS Provider Upgrade §2/§3/§20 — the single source of truth for "which
 * gateway sends the next SMS" and the per-event on/off + template config.
 * A dedicated collection (not a field on the general `Settings` singleton)
 * on purpose: `GET /settings` is reachable by any authenticated role with
 * only `requireAuth` (no permission check) since it holds nothing sensitive
 * today — bolting `alpha.apiKey` onto that document would leak the API key
 * to every logged-in Student/Batch Director. This collection has its own
 * routes, always gated by PERMISSIONS.SMS_MANAGE, and the service layer
 * never serializes `alpha.apiKey` back to the frontend at all (Security §18).
 */
export interface SmsSettingsDoc extends Document {
  activeProvider: SmsProviderName;
  alpha: {
    apiKey?: string;
    senderId?: string;
    contentId?: string;
  };
  events: Record<SmsEventType, boolean>;
  /** "result" is deliberately absent — it keeps using Settings.resultSmsTemplate via the existing /exams/result-sms-template endpoints (do not duplicate template storage). */
  templates: {
    admission: string;
    payment: string;
    birthday: string;
  };
  /** Birthday SMS §8 — "yyyy-mm-dd" of the last calendar day the scheduler finished a full sweep, purely a performance guard (per-student duplicate prevention is enforced via SmsLog regardless of this field). */
  birthdayLastRunDate?: string;
}

const smsSettingsSchema = new Schema<SmsSettingsDoc>(
  {
    activeProvider: { type: String, enum: SMS_PROVIDERS, default: "bulksmsbd" },
    alpha: {
      apiKey: { type: String, select: false },
      senderId: { type: String, trim: true },
      contentId: { type: String, trim: true },
    },
    events: {
      admission: { type: Boolean, default: true },
      payment: { type: Boolean, default: true },
      birthday: { type: Boolean, default: false },
      result: { type: Boolean, default: true },
    },
    templates: {
      admission: { type: String, trim: true, default: DEFAULT_SMS_TEMPLATES.admission },
      payment: { type: String, trim: true, default: DEFAULT_SMS_TEMPLATES.payment },
      birthday: { type: String, trim: true, default: DEFAULT_SMS_TEMPLATES.birthday },
    },
    birthdayLastRunDate: { type: String },
  },
  { timestamps: true },
);

export const SmsSettings = model<SmsSettingsDoc>("SmsSettings", smsSettingsSchema);

// -------------------- SMS History / Log (§14) --------------------

export const SMS_LOG_STATUSES = ["sent", "failed", "disabled"] as const;
export type SmsLogStatus = (typeof SMS_LOG_STATUSES)[number];

/** "test"/"login" are real sends that happen outside the 4 toggleable events (Test SMS §15, existing login-credential SMS) — kept in the same log for one unified history, never a parallel table. */
export const SMS_LOG_EVENT_TYPES = [...SMS_EVENT_TYPES, "login", "test"] as const;
export type SmsLogEventType = (typeof SMS_LOG_EVENT_TYPES)[number];

export interface SmsLogDoc extends Document {
  studentId?: Types.ObjectId;
  staffId?: Types.ObjectId;
  recipient: string;
  eventType: SmsLogEventType;
  provider: SmsProviderName;
  message: string;
  status: SmsLogStatus;
  providerRequestId?: string;
  errorCode?: string;
  errorMessage?: string;
  /** "yyyy-mm-dd" — only set for eventType "birthday", used to prevent a duplicate send to the same student on the same calendar day (§8). */
  sentForDate?: string;
  sentAt?: Date;
  createdAt: Date;
}

const smsLogSchema = new Schema<SmsLogDoc>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "Student" },
    staffId: { type: Schema.Types.ObjectId, ref: "Staff" },
    recipient: { type: String, required: true, trim: true },
    eventType: { type: String, enum: SMS_LOG_EVENT_TYPES, required: true },
    provider: { type: String, enum: SMS_PROVIDERS, required: true },
    message: { type: String, required: true },
    status: { type: String, enum: SMS_LOG_STATUSES, required: true },
    providerRequestId: { type: String, trim: true },
    errorCode: { type: String, trim: true },
    errorMessage: { type: String, trim: true },
    sentForDate: { type: String },
    sentAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

smsLogSchema.index({ createdAt: -1 });
smsLogSchema.index({ studentId: 1, eventType: 1, sentForDate: 1 });

export const SmsLog = model<SmsLogDoc>("SmsLog", smsLogSchema);
