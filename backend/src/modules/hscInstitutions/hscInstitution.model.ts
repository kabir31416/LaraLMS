import { Schema, model, Document } from "mongoose";

/**
 * HSC College/Institution master data (Bulk Student Upload spec §5-§9).
 *
 * `Student.hscInstitution` stays a plain string, never a ref — same
 * established convention as Course/MaterialType/PaymentMethod: the field on
 * Student mirrors this collection's `name` at the moment it was set, so a
 * later rename here never rewrites history on an already-admitted student.
 *
 * Institutions are never "deactivated" (unlike Course/MaterialType) — the
 * whole point is a growing, append-only autocomplete dictionary that any
 * admission/profile-edit/bulk-import can add to, so there is no status
 * field here at all.
 */
export interface HscInstitutionDoc extends Document {
  name: string; // display spelling — whichever casing/spacing was used first
  normalizedName: string; // lowercase, collapsed whitespace — the actual uniqueness/lookup key
  createdAt: Date;
  updatedAt: Date;
}

const hscInstitutionSchema = new Schema<HscInstitutionDoc>(
  {
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, unique: true },
  },
  { timestamps: true },
);

export const HscInstitution = model<HscInstitutionDoc>("HscInstitution", hscInstitutionSchema);
