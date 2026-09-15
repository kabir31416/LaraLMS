import { Schema, model, Document, Types } from "mongoose";

export const DISTRIBUTION_STATUS = ["ACTIVE", "REVERSED"] as const;

/**
 * One line of a distribution transaction. Fully snapshotted (name, type,
 * isPaid, unit price, line total) — §5 "store a price snapshot in the
 * distribution item ... do not modify historical distribution prices" — so
 * a later rename/price-change on the Material never rewrites history, the
 * same "snapshot, reporting only" convention Payment/AdmissionResult use.
 * `materialId` is still kept as a real ref for joins/aggregation (material-
 * wise reports).
 */
export interface MaterialDistributionItem {
  materialId: Types.ObjectId;
  materialName: string;
  materialType: string;
  isPaid: boolean;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

const materialDistributionItemSchema = new Schema<MaterialDistributionItem>(
  {
    materialId: { type: Schema.Types.ObjectId, ref: "Material", required: true },
    materialName: { type: String, required: true, trim: true },
    materialType: { type: String, required: true, trim: true },
    isPaid: { type: Boolean, required: true },
    unitPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

/**
 * A single distribution transaction — one admin/staff action that may hand
 * a student several materials at once (§4). Never hard-deleted (§14): an
 * incorrect entry is reversed (status flips to REVERSED, stock is restored,
 * who/when/why is recorded), the row itself stays forever so Student
 * Material History is always complete.
 */
export interface MaterialDistributionDoc extends Document {
  studentId: Types.ObjectId; // -> Student
  registrationId?: string; // snapshot
  studentRoll?: string; // snapshot
  studentName: string; // snapshot
  phone?: string; // snapshot
  batchId?: Types.ObjectId; // -> Batch, snapshot reference
  batchName?: string; // snapshot
  courseId?: Types.ObjectId; // -> Course, snapshot reference
  courseName?: string; // snapshot

  items: MaterialDistributionItem[];
  totalQuantity: number;
  totalPaidAmount: number; // sum of paid items' lineTotal — 0 when every item is free

  /** Set only when a paid distribution's payment was collected through the existing Payment Transaction system (§6) — never a second/duplicate payment source. */
  paymentId?: Types.ObjectId; // -> Payment

  distributionDate: string; // yyyy-mm-dd
  status: (typeof DISTRIBUTION_STATUS)[number];
  reversedBy?: Types.ObjectId; // -> User
  reversedAt?: Date;
  reversalReason?: string;
  note?: string;

  createdBy: Types.ObjectId; // -> User
  /** Display-name snapshot of whoever distributed this (Staff name, or the actor's role as a fallback for a pure Admin login with no linked Staff record) — §7's "Distributed By" column needs a friendly label, not a raw User._id. */
  distributedByName: string;
  createdAt: Date;
  updatedAt: Date;
}

const materialDistributionSchema = new Schema<MaterialDistributionDoc>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    registrationId: { type: String, trim: true },
    studentRoll: { type: String, trim: true },
    studentName: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    batchId: { type: Schema.Types.ObjectId, ref: "Batch" },
    batchName: { type: String, trim: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course" },
    courseName: { type: String, trim: true },

    items: { type: [materialDistributionItemSchema], required: true, validate: (v: unknown[]) => Array.isArray(v) && v.length > 0 },
    totalQuantity: { type: Number, required: true, min: 1 },
    totalPaidAmount: { type: Number, required: true, default: 0, min: 0 },

    paymentId: { type: Schema.Types.ObjectId, ref: "Payment" },

    distributionDate: { type: String, required: true },
    status: { type: String, enum: DISTRIBUTION_STATUS, default: "ACTIVE" },
    reversedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reversedAt: { type: Date },
    reversalReason: { type: String, trim: true },
    note: { type: String, trim: true },

    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    distributedByName: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

materialDistributionSchema.index({ studentId: 1, createdAt: -1 });
materialDistributionSchema.index({ batchId: 1 });
materialDistributionSchema.index({ status: 1 });
materialDistributionSchema.index({ createdAt: -1 });
materialDistributionSchema.index({ "items.materialId": 1 });

export const MaterialDistribution = model<MaterialDistributionDoc>("MaterialDistribution", materialDistributionSchema);
