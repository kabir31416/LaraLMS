/**
 * Generic SMS template engine — plain-text placeholder substitution only,
 * no code execution of any kind (SMS Template Management §5). Originally
 * lived only in exams/exam.smsTemplate.ts for the Result SMS feature; moved
 * here, unchanged, so every SMS event (Admission/Payment/Birthday/Result)
 * shares the exact same placeholder syntax, extraction and rendering logic
 * instead of each event reimplementing its own regex engine.
 * exam.smsTemplate.ts now re-exports these for Result SMS.
 */
export interface SmsTemplateVariable {
  key: string;
  label: string;
}

const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g;

/** Every `{{name}}` placeholder used in the template, deduplicated, in first-seen order. */
export function extractPlaceholders(template: string): string[] {
  const seen = new Set<string>();
  for (const match of template.matchAll(PLACEHOLDER_PATTERN)) seen.add(match[1]);
  return Array.from(seen);
}

/** Placeholders in the template that aren't one of the caller's known keys — empty means the template is safe to save/use. */
export function validateTemplatePlaceholders(template: string, allowedKeys: Set<string> | string[]): string[] {
  const known = allowedKeys instanceof Set ? allowedKeys : new Set(allowedKeys);
  return extractPlaceholders(template).filter((key) => !known.has(key));
}

/**
 * Resolves every `{{name}}` in the template against the given variable map.
 * A referenced-but-missing value renders as an empty string rather than
 * leaving the raw placeholder in the sent SMS, and rather than the literal
 * text "undefined"/"null" (SMS Template Management §5) — the template was
 * already validated against known keys at save time, so reaching this
 * function with an unknown key only happens for a value that's legitimately
 * blank for this particular student (e.g. no guardian name on file, no
 * Lecture on this exam), never a typo.
 */
export function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(PLACEHOLDER_PATTERN, (_match, key: string) => variables[key] ?? "");
}
