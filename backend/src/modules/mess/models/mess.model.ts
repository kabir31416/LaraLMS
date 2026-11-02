import { Schema, model, Document, Types } from "mongoose";
import { MESS_STAFF_RESPONSIBILITIES, MESS_STATUS, MessStaffResponsibility, MessStatus } from "../mess.constants";

export interface MessStaffAssignment {
  staffId: Types.ObjectId; // -> Staff (existing staff record, never a parallel staff collection)
  responsibility: MessStaffResponsibility;
  assignedAt: Date;
}

export interface MessDoc extends Document {
  name: string;
  /** System-generated (MESS-0001), unique and immutable. */
  code: string;
  address?: string;
  contactNumber?: string;
  openingDate?: string; // yyyy-mm-dd
  notes?: string;
  status: MessStatus;
  /** Per-Mess defaults — when unset, Mess Settings' global values apply. Changing them affects future admissions/bills only. */
  /** Monthly seat rent used when a seat has no rent of its own. */
  defaultRent?: number;
  /** One-time dining charge taken at admission (never billed monthly). */
  defaultDiningCharge?: number;
  /** One-Month Advance taken at admission (held until check-out). */
  defaultDeposit?: number;
  billingDay?: number;
  dueDay?: number;
  /** "yyyy-mm" the backend scheduler last generated this Mess's monthly bills for — claimed atomically so two runners never double-run a month. */
  autoBilledPeriod?: string;
  autoBillingLastRun?: { period: string; at: Date; trigger: string; eligible: number; created: number; skippedExisting: number; failed: number; error?: string };
  /** "yyyy-mm" the due-reminder SMS last went out for. */
  dueReminderPeriod?: string;
  /** Which existing Staff members work at this Mess — also the Mess-level access list for mess staff logins (mess.scope.ts). */
  staff: MessStaffAssignment[];
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const staffAssignmentSchema = new Schema<MessStaffAssignment>(
  {
    staffId: { type: Schema.Types.ObjectId, ref: "Staff", required: true },
    responsibility: { type: String, enum: MESS_STAFF_RESPONSIBILITIES, required: true },
    assignedAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const messSchema = new Schema<MessDoc>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, immutable: true },
    address: { type: String, trim: true },
    contactNumber: { type: String, trim: true },
    openingDate: { type: String },
    notes: { type: String, trim: true },
    status: { type: String, enum: MESS_STATUS, default: "active" },
    defaultRent: { type: Number, min: 0 },
    defaultDiningCharge: { type: Number, min: 0 },
    defaultDeposit: { type: Number, min: 0 },
    billingDay: { type: Number, min: 1, max: 28 },
    dueDay: { type: Number, min: 1, max: 28 },
    autoBilledPeriod: { type: String },
    autoBillingLastRun: {
      period: String,
      at: Date,
      trigger: String,
      eligible: Number,
      created: Number,
      skippedExisting: Number,
      failed: Number,
      error: String,
    },
    dueReminderPeriod: { type: String },
    staff: { type: [staffAssignmentSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

messSchema.index({ "staff.staffId": 1 });
messSchema.index({ status: 1, name: 1 });

export const Mess = model<MessDoc>("Mess", messSchema);
