import { Schema, model, Document, Types } from "mongoose";
import {
  DEFAULT_MESS_SMS_TEMPLATES,
  MessSmsEvent,
  PRORATION_MODES,
  ProrationMode,
  DEFAULT_COMPLAINT_CATEGORIES,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_MAINTENANCE_CATEGORIES,
  DEFAULT_ROOM_TYPES,
  DEFAULT_SEAT_TYPES,
} from "../mess.constants";

/**
 * Mess Settings singleton — its own collection (like MaterialSettings/
 * SmsSettings) so Mess configuration never bloats or changes the general
 * Settings document every role can read. Late fee and proration are OFF by
 * default; nothing about billing changes until an admin turns them on.
 */
export interface MessSettingsDoc extends Document {
  defaultMessId?: Types.ObjectId;
  billingCycle: "monthly";
  billingDay: number; // 1-28 — bill issue day of the month
  dueDay: number; // 1-28
  gracePeriodDays: number;
  defaultRent: number;
  defaultDeposit: number;
  currency: "BDT";
  receiptPrefix: string;
  billPrefix: string;
  lateFeeEnabled: boolean;
  lateFeeAmount: number;
  prorationEnabled: boolean;
  /** Joining-month seat rent rule. Supersedes prorationEnabled when set (prorationEnabled=true ⇔ "prorate"). */
  prorationMode?: ProrationMode;
  /** One-time dining charge taken at admission (never part of a monthly bill). */
  defaultDiningCharge: number;
  /** Backend scheduler generates every active member's monthly bill on the billing day (Asia/Dhaka). On by default — monthly bills are mandatory. */
  autoBillingEnabled: boolean;
  /** Per-event Mess SMS toggles (payment SMS keeps its original paymentSmsEnabled flag). */
  billSmsEnabled: boolean;
  dueReminderSmsEnabled: boolean;
  admissionSmsEnabled: boolean;
  checkoutSmsEnabled: boolean;
  smsTemplates: Record<MessSmsEvent, string>;
  discountApprovalRequired: boolean;
  refundApprovalRequired: boolean;
  expenseApprovalRequired: boolean;
  /** Subset of active PaymentMethod names usable for Mess money. Empty = every active method. */
  paymentMethods: string[];
  paymentSmsEnabled: boolean;
  roomTypes: string[];
  seatTypes: string[];
  complaintCategories: string[];
  maintenanceCategories: string[];
  expenseCategories: string[];
}

const messSettingsSchema = new Schema<MessSettingsDoc>(
  {
    defaultMessId: { type: Schema.Types.ObjectId, ref: "Mess" },
    billingCycle: { type: String, enum: ["monthly"], default: "monthly" },
    billingDay: { type: Number, default: 1, min: 1, max: 28 },
    dueDay: { type: Number, default: 10, min: 1, max: 28 },
    gracePeriodDays: { type: Number, default: 0, min: 0, max: 60 },
    defaultRent: { type: Number, default: 0, min: 0 },
    defaultDeposit: { type: Number, default: 0, min: 0 },
    currency: { type: String, enum: ["BDT"], default: "BDT" },
    receiptPrefix: { type: String, trim: true, default: "MR" },
    billPrefix: { type: String, trim: true, default: "MB" },
    lateFeeEnabled: { type: Boolean, default: false },
    lateFeeAmount: { type: Number, default: 0, min: 0 },
    prorationEnabled: { type: Boolean, default: false },
    prorationMode: { type: String, enum: PRORATION_MODES },
    defaultDiningCharge: { type: Number, default: 0, min: 0 },
    autoBillingEnabled: { type: Boolean, default: true },
    billSmsEnabled: { type: Boolean, default: false },
    dueReminderSmsEnabled: { type: Boolean, default: false },
    admissionSmsEnabled: { type: Boolean, default: false },
    checkoutSmsEnabled: { type: Boolean, default: false },
    smsTemplates: {
      payment: { type: String, default: DEFAULT_MESS_SMS_TEMPLATES.payment },
      bill: { type: String, default: DEFAULT_MESS_SMS_TEMPLATES.bill },
      dueReminder: { type: String, default: DEFAULT_MESS_SMS_TEMPLATES.dueReminder },
      admission: { type: String, default: DEFAULT_MESS_SMS_TEMPLATES.admission },
      checkout: { type: String, default: DEFAULT_MESS_SMS_TEMPLATES.checkout },
    },
    discountApprovalRequired: { type: Boolean, default: false },
    refundApprovalRequired: { type: Boolean, default: true },
    expenseApprovalRequired: { type: Boolean, default: true },
    paymentMethods: { type: [String], default: [] },
    paymentSmsEnabled: { type: Boolean, default: false },
    roomTypes: { type: [String], default: DEFAULT_ROOM_TYPES },
    seatTypes: { type: [String], default: DEFAULT_SEAT_TYPES },
    complaintCategories: { type: [String], default: DEFAULT_COMPLAINT_CATEGORIES },
    maintenanceCategories: { type: [String], default: DEFAULT_MAINTENANCE_CATEGORIES },
    expenseCategories: { type: [String], default: DEFAULT_EXPENSE_CATEGORIES },
  },
  { timestamps: true },
);

export const MessSettings = model<MessSettingsDoc>("MessSettings", messSettingsSchema);
