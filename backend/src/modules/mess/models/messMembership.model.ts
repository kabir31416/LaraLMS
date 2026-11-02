import { Schema, model, Document, Types } from "mongoose";
import { MEMBERSHIP_STATUS, MembershipStatus } from "../mess.constants";

export interface SeatHistoryEntry {
  messId: Types.ObjectId;
  roomId: Types.ObjectId;
  seatId: Types.ObjectId;
  fromDate: string; // yyyy-mm-dd
  toDate?: string;
  monthlyRent: number;
  reason?: string;
  changedBy?: Types.ObjectId;
}

export interface StatusHistoryEntry {
  status: MembershipStatus;
  at: Date;
  by?: Types.ObjectId;
  note?: string;
}

/** Joining-date (and other date) corrections — the adjustment record behind every edit, alongside the AuditLog entry. */
export interface DateChangeEntry {
  field: "joiningDate";
  from: string;
  to: string;
  reason: string;
  at: Date;
  by?: Types.ObjectId;
  bills: { period: string; billNo?: string; oldAmount: number; newAmount: number; action: "cancelled" | "regenerated" | "created" | "unchanged" | "kept" }[];
}

export interface MembershipBalance {
  totalBilled: number;
  totalPaid: number;
  due: number;
  advance: number;
  depositRequired: number;
  depositCollected: number;
  depositBalance: number;
  depositPendingRefund: number;
  updatedAt?: Date;
}

export interface MessMembershipDoc extends Document {
  membershipNo: string;
  /** The canonical existing Student — a Mess member is never a separate student record. */
  studentId: Types.ObjectId;
  messId: Types.ObjectId;
  roomId: Types.ObjectId;
  seatId: Types.ObjectId;
  reservationId?: Types.ObjectId;
  joiningDate: string; // yyyy-mm-dd — the real joining date
  expectedLeavingDate?: string;
  leftDate?: string; // the real leaving date, set on settlement/leave
  monthlyRent: number;
  /** Recurring monthly discount applied to every generated bill. */
  discount: number;
  securityDeposit: number; // required deposit amount
  setupCharge: number; // one-time admission/setup charge, added to the first bill
  setupChargeBilled: boolean;
  billingStartDate: string; // yyyy-mm-dd
  billingCycle: "monthly";
  emergencyContact?: { name?: string; phone?: string; relation?: string };
  notes?: string;
  documents: { label: string; url: string; publicId?: string }[];
  status: MembershipStatus;
  /** Derived from status (pre-validate hook) — backs the "one open membership per student" unique index. */
  isOpen: boolean;
  /** Derived from status — backs the "one seat holder per seat" unique index. */
  holdsSeat: boolean;
  cancelReason?: string;
  seatHistory: SeatHistoryEntry[];
  statusHistory: StatusHistoryEntry[];
  /** Admission: dining charge billed for the joining month (the first bill), and the receipt that paid for it. */
  initialDiningCharge?: number;
  initialPaymentId?: Types.ObjectId;
  dateHistory: DateChangeEntry[];
  settlementId?: Types.ObjectId;
  /** Cached ledger figures, recomputed from bills/payments/deposit transactions by messLedger.service.ts after every financial change. */
  balance: MembershipBalance;
  /** Monotonic counter bumped by every financial mutation — a recompute only writes if no newer mutation has happened since it started (see messLedger.service.ts). */
  ledgerSeq: number;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const seatHistorySchema = new Schema<SeatHistoryEntry>(
  {
    messId: { type: Schema.Types.ObjectId, ref: "Mess", required: true },
    roomId: { type: Schema.Types.ObjectId, ref: "MessRoom", required: true },
    seatId: { type: Schema.Types.ObjectId, ref: "MessSeat", required: true },
    fromDate: { type: String, required: true },
    toDate: { type: String },
    monthlyRent: { type: Number, default: 0 },
    reason: { type: String, trim: true },
    changedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { _id: false },
);

const statusHistorySchema = new Schema<StatusHistoryEntry>(
  {
    status: { type: String, enum: MEMBERSHIP_STATUS, required: true },
    at: { type: Date, default: () => new Date() },
    by: { type: Schema.Types.ObjectId },
    note: { type: String, trim: true },
  },
  { _id: false },
);

const balanceSchema = new Schema<MembershipBalance>(
  {
    totalBilled: { type: Number, default: 0 },
    totalPaid: { type: Number, default: 0 },
    due: { type: Number, default: 0 },
    advance: { type: Number, default: 0 },
    depositRequired: { type: Number, default: 0 },
    depositCollected: { type: Number, default: 0 },
    depositBalance: { type: Number, default: 0 },
    depositPendingRefund: { type: Number, default: 0 },
    updatedAt: { type: Date },
  },
  { _id: false },
);

const messMembershipSchema = new Schema<MessMembershipDoc>(
  {
    membershipNo: { type: String, required: true, unique: true, immutable: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    messId: { type: Schema.Types.ObjectId, ref: "Mess", required: true },
    roomId: { type: Schema.Types.ObjectId, ref: "MessRoom", required: true },
    seatId: { type: Schema.Types.ObjectId, ref: "MessSeat", required: true },
    reservationId: { type: Schema.Types.ObjectId, ref: "MessReservation" },
    joiningDate: { type: String, required: true },
    expectedLeavingDate: { type: String },
    leftDate: { type: String },
    monthlyRent: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    securityDeposit: { type: Number, default: 0, min: 0 },
    setupCharge: { type: Number, default: 0, min: 0 },
    setupChargeBilled: { type: Boolean, default: false },
    billingStartDate: { type: String, required: true },
    billingCycle: { type: String, enum: ["monthly"], default: "monthly" },
    emergencyContact: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
      relation: { type: String, trim: true },
    },
    notes: { type: String, trim: true },
    documents: { type: [{ label: String, url: String, publicId: String, _id: false }], default: [] },
    status: { type: String, enum: MEMBERSHIP_STATUS, default: "pending" },
    isOpen: { type: Boolean, default: true },
    holdsSeat: { type: Boolean, default: false },
    cancelReason: { type: String, trim: true },
    seatHistory: { type: [seatHistorySchema], default: [] },
    statusHistory: { type: [statusHistorySchema], default: [] },
    initialDiningCharge: { type: Number, min: 0 },
    initialPaymentId: { type: Schema.Types.ObjectId, ref: "MessPayment" },
    dateHistory: {
      type: [
        {
          _id: false,
          field: { type: String, enum: ["joiningDate"], required: true },
          from: String,
          to: String,
          reason: String,
          at: Date,
          by: { type: Schema.Types.ObjectId, ref: "User" },
          bills: [{ _id: false, period: String, billNo: String, oldAmount: Number, newAmount: Number, action: String }],
        },
      ],
      default: [],
    },
    settlementId: { type: Schema.Types.ObjectId, ref: "MessSettlement" },
    balance: { type: balanceSchema, default: () => ({}) },
    ledgerSeq: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

// Duplicate-active-membership guard. Partial unique indexes (rather than a
// read-then-write check alone) make it impossible even for two concurrent
// requests — the second insert/update fails with E11000.
messMembershipSchema.index({ studentId: 1 }, { unique: true, partialFilterExpression: { isOpen: true } });
messMembershipSchema.index({ seatId: 1 }, { unique: true, partialFilterExpression: { holdsSeat: true } });
messMembershipSchema.index({ studentId: 1, createdAt: -1 });
messMembershipSchema.index({ messId: 1, status: 1 });
messMembershipSchema.index({ "seatHistory.seatId": 1 });

export const MessMembership = model<MessMembershipDoc>("MessMembership", messMembershipSchema);
