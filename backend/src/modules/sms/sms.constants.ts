import type { SmsTemplateVariable } from "./sms.template";

/**
 * SMS Provider Upgrade — the two gateways this ERP can send through. Adding
 * a third provider later means adding one entry here plus one file under
 * providers/, never touching Admission/Payment/Birthday/Result SMS code
 * (they only ever call sms.service.ts's sendSms(), never a provider directly).
 */
export const SMS_PROVIDERS = ["bulksmsbd", "alpha"] as const;
export type SmsProviderName = (typeof SMS_PROVIDERS)[number];

/**
 * The events an Admin can independently enable/disable and template
 * (Admin SMS Settings §4/§5). "result" is deliberately NOT templated here —
 * it keeps using the existing, already-working Result SMS template system
 * (Settings.resultSmsTemplate + GET/PATCH /exams/result-sms-template), never
 * duplicated into this module's storage.
 */
export const SMS_EVENT_TYPES = ["admission", "payment", "birthday", "result"] as const;
export type SmsEventType = (typeof SMS_EVENT_TYPES)[number];

/** Events with their own template stored on SmsSettings.templates — "result" is excluded (see above). */
export const SMS_TEMPLATED_EVENTS = ["admission", "payment", "birthday"] as const;
export type SmsTemplatedEvent = (typeof SMS_TEMPLATED_EVENTS)[number];

/**
 * Every variable list below maps to fields that actually exist at the point
 * each event fires (student.service.ts's create(), payment.service.ts's
 * create(), the birthday scheduler) — nothing invented, same discipline as
 * exam.smsTemplate.ts's RESULT_SMS_VARIABLES.
 */
export const ADMISSION_SMS_VARIABLES: SmsTemplateVariable[] = [
  { key: "studentName", label: "শিক্ষার্থীর নাম" },
  { key: "registrationId", label: "রেজিস্ট্রেশন আইডি" },
  { key: "roll", label: "রোল নম্বর" },
  { key: "courseName", label: "কোর্সের নাম" },
  { key: "batchName", label: "ব্যাচের নাম (ভর্তির সময় নির্ধারিত না থাকলে খালি)" },
  { key: "guardianName", label: "অভিভাবকের নাম" },
];

export const PAYMENT_SMS_VARIABLES: SmsTemplateVariable[] = [
  { key: "studentName", label: "শিক্ষার্থীর নাম" },
  { key: "registrationId", label: "রেজিস্ট্রেশন আইডি" },
  { key: "roll", label: "রোল নম্বর" },
  { key: "courseName", label: "কোর্সের নাম" },
  { key: "paymentAmount", label: "এই পেমেন্টের পরিমাণ" },
  { key: "totalPaid", label: "সর্বমোট পরিশোধিত" },
  { key: "due", label: "বর্তমান বকেয়া" },
  { key: "receiptNo", label: "রসিদ নম্বর" },
];

export const BIRTHDAY_SMS_VARIABLES: SmsTemplateVariable[] = [
  { key: "studentName", label: "শিক্ষার্থীর নাম" },
  { key: "registrationId", label: "রেজিস্ট্রেশন আইডি" },
  { key: "roll", label: "রোল নম্বর" },
  { key: "courseName", label: "কোর্সের নাম" },
  { key: "guardianName", label: "অভিভাবকের নাম" },
];

export const SMS_EVENT_VARIABLES: Record<SmsTemplatedEvent, SmsTemplateVariable[]> = {
  admission: ADMISSION_SMS_VARIABLES,
  payment: PAYMENT_SMS_VARIABLES,
  birthday: BIRTHDAY_SMS_VARIABLES,
};

export const DEFAULT_ADMISSION_SMS_TEMPLATE =
  "প্রিয় অভিভাবক,\n{{studentName}} (রোল: {{roll}}) সফলভাবে {{courseName}}-এ ভর্তি হয়েছে। রেজিস্ট্রেশন আইডি: {{registrationId}}। ধন্যবাদ।";

export const DEFAULT_PAYMENT_SMS_TEMPLATE =
  "প্রিয় অভিভাবক,\n{{studentName}} (রোল: {{roll}})-এর পক্ষ থেকে ৳{{paymentAmount}} পরিশোধ গৃহীত হয়েছে। রসিদ: {{receiptNo}}। সর্বমোট পরিশোধিত: ৳{{totalPaid}}, বকেয়া: ৳{{due}}।";

export const DEFAULT_BIRTHDAY_SMS_TEMPLATE =
  "শুভ জন্মদিন {{studentName}}! আজকের এই বিশেষ দিনে আমাদের পক্ষ থেকে অনেক শুভকামনা। — {{courseName}}";

export const DEFAULT_SMS_TEMPLATES: Record<SmsTemplatedEvent, string> = {
  admission: DEFAULT_ADMISSION_SMS_TEMPLATE,
  payment: DEFAULT_PAYMENT_SMS_TEMPLATE,
  birthday: DEFAULT_BIRTHDAY_SMS_TEMPLATE,
};

/**
 * Alpha SMS (sms.net.bd) error-code -> safe internal message map (Alpha SMS
 * Response Handling §11). The raw code is always kept alongside this in
 * SmsLog for debugging; this text is what's safe to show an Admin.
 */
export const ALPHA_SMS_ERROR_MESSAGES: Record<number, string> = {
  400: "প্রয়োজনীয় তথ্য অনুপস্থিত বা ভুল",
  403: "অনুমতি নেই",
  404: "রিসোর্স পাওয়া যায়নি",
  405: "অথোরাইজেশন প্রয়োজন — API Key সঠিক কিনা যাচাই করুন",
  409: "Alpha SMS সার্ভারে অজানা ত্রুটি",
  410: "Alpha SMS অ্যাকাউন্টের মেয়াদ শেষ",
  411: "রিসেলার অ্যাকাউন্টের মেয়াদ শেষ অথবা স্থগিত",
  412: "শিডিউল সময় সঠিক নয়",
  413: "Sender ID সঠিক নয়",
  414: "মেসেজ খালি রাখা যাবে না",
  415: "মেসেজ অনেক বড়",
  416: "কোনো সঠিক মোবাইল নম্বর পাওয়া যায়নি",
  417: "Alpha SMS ব্যালেন্স অপর্যাপ্ত",
  420: "মেসেজের কনটেন্ট ব্লক করা হয়েছে",
  421: "প্রথম রিচার্জের আগ পর্যন্ত শুধু রেজিস্টার্ড নম্বরে পাঠানো যাবে",
};

export function alphaErrorMessage(code: number): string {
  return ALPHA_SMS_ERROR_MESSAGES[code] ?? "Alpha SMS পাঠাতে ব্যর্থ হয়েছে";
}
