import { Schema, model, Document } from "mongoose";

/**
 * Design/print options for Student ID Cards and Admit Cards — a singleton
 * like MaterialSettings. Institution name, logo, address and contact details
 * are NOT duplicated here: they always come from InstitutionSettings.
 */
export const ID_CARD_LAYOUTS = ["landscape", "portrait"] as const;
export const VALIDITY_MODES = ["session", "date", "none"] as const;

export interface CardSettingsDoc extends Document {
  /** Brand colour used on both cards (hex). */
  primaryColor: string;
  idCardLayout: (typeof ID_CARD_LAYOUTS)[number];
  /** Print the back side (contact, rules, emergency contact, QR). */
  idCardShowBack: boolean;
  /** "session": the student's course session (name + end date); "date": validUntil below; "none": no validity line. */
  validityMode: (typeof VALIDITY_MODES)[number];
  validUntil?: string; // yyyy-mm-dd
  /** One rule per line, printed on the back side. */
  idCardRules: string;
  /** Show the guardian's phone as the emergency contact on the back side. */
  idCardShowEmergencyContact: boolean;
  idCardShowQr: boolean;
  admitShowQr: boolean;
  /** Pre-filled into a new exam's instructions. */
  admitDefaultInstructions: string;
  /** 1 (default, one admit card per A4 page) or 2 (two half-page cards). */
  admitCardsPerPage: 1 | 2;
}

const cardSettingsSchema = new Schema<CardSettingsDoc>(
  {
    primaryColor: { type: String, trim: true, default: "#1e3a8a", match: /^#[0-9a-fA-F]{6}$/ },
    idCardLayout: { type: String, enum: ID_CARD_LAYOUTS, default: "landscape" },
    idCardShowBack: { type: Boolean, default: true },
    validityMode: { type: String, enum: VALIDITY_MODES, default: "session" },
    validUntil: { type: String, trim: true },
    idCardRules: {
      type: String,
      default: "এই কার্ড হস্তান্তরযোগ্য নয়।\nপ্রতিষ্ঠানে প্রবেশের সময় কার্ড সঙ্গে রাখতে হবে।\nকার্ড হারিয়ে গেলে অবিলম্বে অফিসে জানাতে হবে।",
    },
    idCardShowEmergencyContact: { type: Boolean, default: true },
    idCardShowQr: { type: Boolean, default: true },
    admitShowQr: { type: Boolean, default: true },
    admitDefaultInstructions: {
      type: String,
      default: "পরীক্ষা শুরুর অন্তত ১৫ মিনিট আগে কেন্দ্রে উপস্থিত হতে হবে।\nএই অ্যাডমিট কার্ড ও আইডি কার্ড সঙ্গে আনতে হবে।\nমোবাইল ফোন ও ইলেকট্রনিক ডিভাইস সম্পূর্ণ নিষিদ্ধ।",
    },
    admitCardsPerPage: { type: Number, enum: [1, 2], default: 1 },
  },
  { timestamps: true },
);

export const CardSettings = model<CardSettingsDoc>("CardSettings", cardSettingsSchema);
