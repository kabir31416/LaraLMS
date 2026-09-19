import { Schema, model, Document } from "mongoose";

export const STAFF_TYPES = ["Admin", "Teacher", "Staff", "Batch Director"] as const;
export const STAFF_STATUS = ["সক্রিয়", "নিষ্ক্রিয়"] as const; // matches the frontend's existing Bengali enum exactly

export interface StaffDoc extends Document {
  name: string;
  photoUrl?: string;
  phone: string;
  email?: string;
  address?: string;
  staffType: (typeof STAFF_TYPES)[number];
  salary: number;
  joinDate: string;
  status: (typeof STAFF_STATUS)[number];
  /** The Staff Portal credential (see auth.service.ts's staffLogin) — phone + staffId matching this same record IS the login, no separate password/account. */
  staffId?: string;
  /**
   * Retired: a Batch Director could once set their own custom Result SMS
   * template here. The Result SMS format is now a single, system-wide
   * setting editable only from the Admin dashboard
   * (settings.model.ts's SettingsDoc.resultSmsTemplate) — this field is no
   * longer read or written anywhere, kept only so any value a director
   * previously set isn't silently deleted from existing data.
   */
  resultSmsTemplate?: string;
  createdAt: Date;
  updatedAt: Date;
}

const staffSchema = new Schema<StaffDoc>(
  {
    name: { type: String, required: true, trim: true },
    photoUrl: String,
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    staffType: { type: String, enum: STAFF_TYPES, required: true },
    salary: { type: Number, default: 0 },
    joinDate: { type: String, required: true },
    status: { type: String, enum: STAFF_STATUS, default: "সক্রিয়" },
    staffId: { type: String, trim: true },
    resultSmsTemplate: { type: String, trim: true },
  },
  { timestamps: true },
);

staffSchema.index({ staffType: 1, status: 1 });
staffSchema.index({ name: "text", phone: "text" });
// Partial: only documents that actually have a staffId are indexed, so older
// staff rows created before this field existed don't collide with each other
// on a shared "missing value" the way a plain unique index would.
staffSchema.index({ staffId: 1 }, { unique: true, partialFilterExpression: { staffId: { $exists: true, $type: "string" } } });

export const Staff = model<StaffDoc>("Staff", staffSchema);
