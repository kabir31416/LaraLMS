/**
 * These mirror the Bengali string enums already in the frontend's
 * `src/types/student.ts` exactly (FEE_TYPES, GENDERS, RELATIONS, statuses).
 * Keeping the same literal values here — instead of translating to an
 * English enum and mapping at the API boundary — is what lets the existing
 * UI (badges, filters, form options) work against the real API completely
 * unchanged. Course/Section/Group/Subjects stay free text for the same
 * reason; unifying them with the real Course/Subject collections from
 * Modules 6-9 is tracked as a follow-up (Phase 1 §10, §20), not done here.
 */
export const FEE_TYPES = ["এককালীন", "মাসিক"] as const;
export const GENDERS = ["পুরুষ", "মহিলা", "অন্যান্য"] as const;
export const RELATIONS = ["পিতা", "মাতা", "ভাই", "বোন", "অন্যান্য"] as const;
export const ADMISSION_TYPES = ["নতুন", "পুরাতন"] as const;
export const STUDENT_STATUS = ["সক্রিয়", "নিষ্ক্রিয়"] as const;

/**
 * A separate, fixed one-time Admission Fee — never part of Course Fee, and
 * not editable from the admission form (Phase 4 requirement). Kept as a
 * constant rather than a Settings field since the business rule is "always
 * 200", not admin-configurable.
 */
export const ADMISSION_FEE_BDT = 200;
