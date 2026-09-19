import { Schema, model, Document } from "mongoose";
import { MASTER_DATA_STATUS } from "../academicSessions/academicSession.model";

/**
 * Coaching Material Inventory (§2 of the spec) — configurable master data for
 * the kind of material distributed (Lecture Sheet, Class Note, Model Test,
 * Question Bank, Handout, Suggestion, Other), replacing any hard-coded type
 * list. `Material.materialType` stays a plain string (not a ref) — same
 * convention as `PaymentMethod`/`Payment.method` — so an existing Material
 * keeps showing whatever type name it was created with even if that type is
 * later renamed/deactivated here.
 */
export interface MaterialTypeDoc extends Document {
  name: string;
  status: (typeof MASTER_DATA_STATUS)[number];
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const materialTypeSchema = new Schema<MaterialTypeDoc>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    status: { type: String, enum: MASTER_DATA_STATUS, default: "সক্রিয়" },
    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const MaterialType = model<MaterialTypeDoc>("MaterialType", materialTypeSchema);
