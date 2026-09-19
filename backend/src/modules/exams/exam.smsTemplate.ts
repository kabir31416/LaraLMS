/**
 * Result SMS template system (Result Entry's "Send Result" action).
 *
 * Pure string utilities only — no DB/model imports — so this can safely be
 * imported from settings.model.ts (for the Settings-wide default value)
 * without creating a module dependency cycle.
 *
 * Every variable below maps to a field that actually exists on
 * Student/Guardian/Batch/OfflineExam/Subject or is computed from
 * Settings.gradeScale/passingPercentage (see exam.service.ts's
 * buildResultSmsVariables) — nothing here is invented.
 */
export interface ResultSmsVariable {
  key: string;
  label: string;
}

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
];

const VARIABLE_KEYS = new Set(RESULT_SMS_VARIABLES.map((v) => v.key));

export const DEFAULT_RESULT_SMS_TEMPLATE =
  "প্রিয় অভিভাবক,\n{{studentName}} (রোল: {{roll}})-এর {{examName}} পরীক্ষার ফলাফল:\nপ্রাপ্ত নম্বর: {{obtainedMarks}}/{{fullMarks}}\nশতকরা: {{percentage}}%\nগ্রেড: {{grade}}\nফলাফল: {{result}}";

const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;

/** Every `{{name}}` placeholder used in the template, deduplicated, in first-seen order. */
export function extractPlaceholders(template: string): string[] {
  const seen = new Set<string>();
  for (const match of template.matchAll(PLACEHOLDER_PATTERN)) seen.add(match[1]);
  return Array.from(seen);
}

/** Placeholders in the template that aren't one of RESULT_SMS_VARIABLES's known keys — empty means the template is safe to save/use. */
export function validateTemplatePlaceholders(template: string): string[] {
  return extractPlaceholders(template).filter((key) => !VARIABLE_KEYS.has(key));
}

/**
 * Resolves every `{{name}}` in the template against the given variable map.
 * A referenced-but-missing value renders as an empty string rather than
 * leaving the raw placeholder in the sent SMS — the template was already
 * validated against known keys at save time (validateTemplatePlaceholders),
 * so reaching this function with an unknown key would only happen for a
 * value that's legitimately blank for this particular student (e.g. no
 * guardian name on file), not a typo.
 */
export function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(PLACEHOLDER_PATTERN, (_match, key: string) => variables[key] ?? "");
}
