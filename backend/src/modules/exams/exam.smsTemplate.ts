/**
 * Result SMS template system (Result Entry's "Send Result" action).
 *
 * The generic placeholder engine (extractPlaceholders/renderTemplate/
 * validateTemplatePlaceholders) now lives in modules/sms/sms.template.ts —
 * shared with the SMS Provider Upgrade's Admission/Payment/Birthday
 * templates — so this file keeps only what's actually Result-specific: the
 * variable list and the default template. Re-exported below unchanged so
 * every existing import of this file keeps working exactly as before.
 *
 * Pure/DB-free (aside from the shared import, itself DB-free) — so this can
 * safely be imported from settings.model.ts (for the Settings-wide default
 * value) without creating a module dependency cycle.
 *
 * Every variable below maps to a field that actually exists on
 * Student/Guardian/Batch/OfflineExam/Subject or is computed from
 * Settings.gradeScale/passingPercentage (see exam.service.ts's
 * buildResultSmsVariables) — nothing here is invented.
 */
import { extractPlaceholders, renderTemplate, validateTemplatePlaceholders as validateAgainst, SmsTemplateVariable } from "../sms/sms.template";

export type ResultSmsVariable = SmsTemplateVariable;
export { extractPlaceholders, renderTemplate };

export const RESULT_SMS_VARIABLES: ResultSmsVariable[] = [
  { key: "studentName", label: "শিক্ষার্থীর নাম" },
  { key: "roll", label: "রোল (ব্যাচের বর্তমান রোল)" },
  { key: "registrationId", label: "রেজিস্ট্রেশন আইডি" },
  { key: "courseName", label: "কোর্সের নাম" },
  { key: "batchName", label: "ব্যাচের নাম" },
  { key: "examName", label: "এক্সামের নাম (সাবজেক্ট - লেকচার)" },
  { key: "subjectName", label: "সাবজেক্টের নাম" },
  { key: "fullMarks", label: "পূর্ণ নম্বর" },
  { key: "obtainedMarks", label: "প্রাপ্ত নম্বর (অনুপস্থিত হলে টেক্সট)" },
  { key: "percentage", label: "শতকরা হার" },
  { key: "grade", label: "গ্রেড" },
  { key: "result", label: "ফলাফল (পাস/ফেল/অনুপস্থিত)" },
  { key: "guardianName", label: "অভিভাবকের নাম" },
  { key: "date", label: "পরীক্ষার তারিখ" },
  { key: "highestMark", label: "এই এক্সামের সর্বোচ্চ প্রাপ্ত নম্বর" },
];

const VARIABLE_KEYS = new Set(RESULT_SMS_VARIABLES.map((v) => v.key));

export const DEFAULT_RESULT_SMS_TEMPLATE =
  "প্রিয় অভিভাবক,\n{{studentName}} (রোল: {{roll}})-এর {{examName}} পরীক্ষার ফলাফল:\nপ্রাপ্ত নম্বর: {{obtainedMarks}}/{{fullMarks}}\nশতকরা: {{percentage}}%\nগ্রেড: {{grade}}\nফলাফল: {{result}}";

/** Placeholders in the template that aren't one of RESULT_SMS_VARIABLES's known keys — empty means the template is safe to save/use. */
export function validateTemplatePlaceholders(template: string): string[] {
  return validateAgainst(template, VARIABLE_KEYS);
}
