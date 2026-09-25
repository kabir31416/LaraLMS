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
 * HSC/SSC "বিভাগ" (renamed from "গ্রুপ") — HSC-Institution-Autocomplete/
 * বিভাগ audit §5/§8. `hscGroup`/`sscGroup` were previously unconstrained
 * free text (no enum anywhere, backend or frontend); this is the first
 * canonical list for them. Enforced only at the Zod validation layer
 * (student.validation.ts / publicStudentEntry.validation.ts) — deliberately
 * NOT added as a Mongoose `enum` on the schema field itself, so an existing
 * student record carrying an old value ("Science", "বাণিজ্য", etc.) never
 * fails full-document `.save()` validation for an unrelated field edit;
 * only a request that actually SETS this field is required to use one of
 * these three values. See scripts/migrate-hsc-ssc-group.ts for safely
 * normalizing old values.
 */
export const HSC_SSC_GROUPS = ["বিজ্ঞান", "মানবিক", "ব্যবসায়"] as const;

/**
 * Student Entry Workflow — a student created through the public entry flows
 * (/newstudententry, then optionally completed via /studententry) starts
 * `"pending"` and is never treated as a real, batch-enrolled student until an
 * Admin explicitly approves it. Deliberately a SEPARATE field from `status`
 * above (Active/Inactive) rather than a third value added to that enum —
 * `status` is a well-established 2-value field read across exports/reports/
 * filters everywhere else in the app, and retrofitting it risks surprising
 * every one of those call sites. An absent `admissionStatus` (every student
 * created any other way — Admin Admission, Bulk Import, Excel) is treated as
 * already-approved by construction (see student.service.ts's buildStudentFilter).
 */
export const ADMISSION_ENTRY_STATUS = ["pending", "approved", "rejected"] as const;
