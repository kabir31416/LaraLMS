import mongoose, { Schema } from "mongoose";

/**
 * Atomic sequence counter, backing every human-facing generated id
 * (Registration ID, Receipt Number, Book Code, ...).
 * Replaces the frontend's `Date.now() + Math.random()` scheme flagged
 * as non-portable in the Phase 1 review (§11).
 */
interface CounterDoc {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<CounterDoc>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.model<CounterDoc>("Counter", counterSchema);

async function nextSeq(key: string): Promise<number> {
  const doc = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  ).lean();
  return doc!.seq;
}

/** LMS-01247 style, continuing the existing frontend format/counter start. */
export async function generateRegistrationId(): Promise<string> {
  const seq = await nextSeq("student_registration_id");
  return `LMS-${String(1246 + seq).padStart(5, "0")}`;
}

/**
 * RCPT-2026-0011 style by default — prefix/padding/yearly-reset all come
 * from InstitutionSettings.receipt (Settings §9) rather than being
 * hard-coded, so an admin changing them only affects *future* receipts;
 * every already-issued receiptNo is an immutable string already stored on
 * its Payment document and is never touched by this (Settings §24).
 */
export async function generateReceiptNumber(): Promise<string> {
  const { getInstitutionSettings } = await import("../../modules/settings/institution.service");
  const settings = await getInstitutionSettings();
  const prefix = settings.receipt.prefix || "RCPT";
  const padding = settings.receipt.numberPadding || 4;
  if (settings.receipt.resetYearly) {
    const year = new Date().getFullYear();
    const seq = await nextSeq(`receipt_${prefix}_${year}`);
    return `${prefix}-${year}-${String(seq).padStart(padding, "0")}`;
  }
  const seq = await nextSeq(`receipt_${prefix}`);
  return `${prefix}-${String(seq).padStart(padding, "0")}`;
}

/** BK-0007 style. */
export async function generateBookCode(): Promise<string> {
  const seq = await nextSeq("book_code");
  return `BK-${String(seq).padStart(4, "0")}`;
}
