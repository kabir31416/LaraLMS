import { Schema, model, Document, Types } from "mongoose";
import { MASTER_DATA_STATUS } from "../academicSessions/academicSession.model";

/**
 * Coaching Material Inventory — the master catalog of distributable items
 * (Lecture Sheet, Printed Notes, Model Test, Question Bank, Suggestion,
 * Handout, ...). Deliberately NOT a library-book record: no author,
 * publisher, ISBN, or edition — those fields don't mean anything for a
 * coaching centre's own lecture sheets/notes/tests.
 *
 * `currentStock` is never written directly by an update — it only ever
 * changes through a StockMovement-creating operation (add stock, adjust,
 * distribute, reverse) so every change is auditable (§3 "never silently
 * overwrite stock").
 */
export interface MaterialDoc extends Document {
  name: string;
  /** Plain string snapshot of MaterialType.name (like Payment.method / Material.materialType convention) — validated against active MaterialType at write time, never a ref, so a later type rename/deactivation doesn't retroactively change this material's label. */
  materialType: string;
  courseId: Types.ObjectId; // -> Course
  subjectId?: Types.ObjectId; // -> Subject, optional
  isPaid: boolean;
  price: number; // 0 when !isPaid; required > 0 when isPaid (enforced in validation + service)
  openingStock: number; // recorded once, at creation — historical reference only
  currentStock: number; // the live balance, maintained exclusively via StockMovement-creating operations
  minimumStock: number;
  status: (typeof MASTER_DATA_STATUS)[number];
  description?: string;
  createdBy?: Types.ObjectId; // -> User
  updatedBy?: Types.ObjectId; // -> User
  createdAt: Date;
  updatedAt: Date;
}

const materialSchema = new Schema<MaterialDoc>(
  {
    name: { type: String, required: true, trim: true },
    materialType: { type: String, required: true, trim: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    subjectId: { type: Schema.Types.ObjectId, ref: "Subject" },
    isPaid: { type: Boolean, required: true, default: false },
    price: { type: Number, required: true, default: 0, min: 0 },
    openingStock: { type: Number, required: true, default: 0, min: 0 },
    currentStock: { type: Number, required: true, default: 0, min: 0 },
    minimumStock: { type: Number, required: true, default: 0, min: 0 },
    status: { type: String, enum: MASTER_DATA_STATUS, default: "সক্রিয়" },
    description: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

materialSchema.index({ name: "text" });
// A course's material list shouldn't have the exact same name typed twice — same convention as Course's own { sessionId, name } unique index.
materialSchema.index({ courseId: 1, name: 1 }, { unique: true });
materialSchema.index({ status: 1 });
materialSchema.index({ materialType: 1 });

export const Material = model<MaterialDoc>("Material", materialSchema);
