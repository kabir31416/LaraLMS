import { Schema, model, Document, Types } from "mongoose";

/**
 * Organization-wide branding/config singleton (Settings §2/§9/§20) — the one
 * place Institution Name/Logo/Address/Currency/Receipt-format live, reused by
 * Receipt, PDF, Marksheet, Reports, and the public /info + /marksheet pages
 * instead of being hard-coded per module. Mirrors PublicInfoSettings' own
 * singleton pattern below it in settings.model.ts.
 */
export interface InstitutionSettingsDoc extends Document {
  name: string;
  shortName?: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  facebookUrl?: string;
  currencySymbol: string;
  dateFormat: string;
  timezone: string;
  registrationInfo?: string;
  defaultBranchId?: Types.ObjectId;
  receipt: {
    prefix: string;
    numberPadding: number;
    /** true (default) keeps today's RCPT-2026-0001 behavior — a fresh counter every calendar year. false runs one continuous sequence. */
    resetYearly: boolean;
  };
  print: {
    footerText?: string;
    signatureLabel: string;
    paperSize: "A4" | "Letter";
    showLogoOnDocuments: boolean;
  };
}

const institutionSettingsSchema = new Schema<InstitutionSettingsDoc>(
  {
    name: { type: String, trim: true, default: "কোচিং সেন্টার" },
    shortName: { type: String, trim: true },
    logoUrl: { type: String, trim: true },
    address: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true },
    website: { type: String, trim: true },
    facebookUrl: { type: String, trim: true },
    currencySymbol: { type: String, trim: true, default: "৳" },
    dateFormat: { type: String, trim: true, default: "DD/MM/YYYY" },
    timezone: { type: String, trim: true, default: "Asia/Dhaka" },
    registrationInfo: { type: String, trim: true },
    defaultBranchId: { type: Schema.Types.ObjectId, ref: "Branch" },
    receipt: {
      prefix: { type: String, trim: true, default: "RCPT" },
      numberPadding: { type: Number, default: 4, min: 1, max: 10 },
      resetYearly: { type: Boolean, default: true },
    },
    print: {
      footerText: { type: String, trim: true },
      signatureLabel: { type: String, trim: true, default: "অনুমোদিতকারী" },
      paperSize: { type: String, enum: ["A4", "Letter"], default: "A4" },
      showLogoOnDocuments: { type: Boolean, default: true },
    },
  },
  { timestamps: true },
);

export const InstitutionSettings = model<InstitutionSettingsDoc>("InstitutionSettings", institutionSettingsSchema);

/** The only fields ever exposed on the no-login /public/institution endpoint — never email/registrationInfo/receipt/print internals (Settings §18 "safe allowlist"). */
export const PUBLIC_INSTITUTION_FIELDS = ["name", "shortName", "logoUrl", "address", "phone", "website", "currencySymbol"] as const;
