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

/**
 * `findByIdAndUpdate` with `upsert: true` is NOT safe against two concurrent
 * callers incrementing the *same brand-new* key for the first time (e.g. two
 * payments racing to create the very first "receipt_RCPT" counter document,
 * or the first payment right after a yearly counter key rolls over) — Mongo
 * can throw a duplicate-key error (E11000) on the upsert's own insert when
 * both requests reach it before either commits. That error carries the same
 * error code the app's other genuine "this value already exists" checks
 * use, so it was surfacing to the client as a generic "record already
 * exists" — for what is, from the caller's point of view, a perfectly valid
 * brand-new payment. Once either racer has created the document, a plain
 * (non-upsert) `$inc` is an ordinary atomic update with no race at all, so
 * retrying once without `upsert` after a 11000 always resolves cleanly.
 */
async function nextSeq(key: string): Promise<number> {
  try {
    const doc = await Counter.findByIdAndUpdate(
      key,
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
    ).lean();
    return doc!.seq;
  } catch (err) {
    if ((err as { code?: number } | null)?.code === 11000) {
      const doc = await Counter.findByIdAndUpdate(key, { $inc: { seq: 1 } }, { new: true }).lean();
      if (doc) return doc.seq;
    }
    throw err;
  }
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
