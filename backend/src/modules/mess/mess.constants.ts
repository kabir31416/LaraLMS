/**
 * Mess / Hostel Management — fixed workflow enums.
 *
 * Statuses are workflow-bound (the services below branch on them), so they
 * are system-defined rather than admin-editable. Free-form lists such as room
 * types, seat types and expense categories live in MessSettings instead.
 *
 * Meal Management (meal entry/count/rate/billing) is deliberately NOT part of
 * this release. `MESS_BILL_ITEM_KINDS` is the extension point: a future "meal"
 * item kind can be added to a bill without changing the ledger maths.
 */

export const MESS_STATUS = ["active", "inactive"] as const;
export type MessStatus = (typeof MESS_STATUS)[number];

export const MESS_STAFF_RESPONSIBILITIES = ["manager", "accountant", "caretaker", "support"] as const;
export type MessStaffResponsibility = (typeof MESS_STAFF_RESPONSIBILITIES)[number];

export const ROOM_STATUS = ["active", "maintenance", "inactive"] as const;

export const SEAT_STATUS = ["available", "reserved", "occupied", "maintenance", "inactive"] as const;
export type SeatStatus = (typeof SEAT_STATUS)[number];
/** Seat statuses an operator may set by hand. "reserved"/"occupied" are only ever set by the reservation/membership workflow. */
export const SEAT_MANUAL_STATUS = ["available", "maintenance", "inactive"] as const;

export const MEMBERSHIP_STATUS = ["pending", "approved", "active", "on_leave", "notice_given", "left", "cancelled"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUS)[number];
/** Still a live application/membership — at most one per student (unique partial index on isOpen). */
export const OPEN_MEMBERSHIP_STATUS: MembershipStatus[] = ["pending", "approved", "active", "on_leave", "notice_given"];
/** Holds the seat — at most one per seat (unique partial index on holdsSeat). A pending application only *requests* a seat. */
export const SEAT_HOLDING_STATUS: MembershipStatus[] = ["approved", "active", "on_leave", "notice_given"];
/** Billable each month. On-leave members keep their seat, so rent continues. */
export const BILLABLE_STATUS: MembershipStatus[] = ["active", "on_leave", "notice_given"];
/** Seat shows as "occupied" (vs "reserved" for an approved-but-not-yet-active member). */
export const OCCUPYING_STATUS: MembershipStatus[] = ["active", "on_leave", "notice_given"];

export const RESERVATION_STATUS = ["active", "converted", "expired", "cancelled"] as const;

export const MESS_BILL_ITEM_KINDS = ["rent", "setup", "additional", "late_fee"] as const;
export const MESS_BILL_STATUS = ["unpaid", "partial", "paid", "cancelled"] as const;

/**
 * "rent" money goes to the dues/advance ledger (monthly dining charge);
 * "deposit" money is the refundable One-Month Advance / Security Deposit
 * held on the member's behalf (never income); "initial" is the single
 * admission receipt that covers both — its `allocation` says how much of it
 * went to the dining charge and how much to the advance/deposit, so the same
 * taka is never counted twice.
 */
export const MESS_PAYMENT_PURPOSE = ["rent", "deposit", "initial"] as const;
export type MessPaymentPurpose = (typeof MESS_PAYMENT_PURPOSE)[number];

/**
 * When the One-Month Advance / Security Deposit is used against dining dues:
 *  - on_checkout: held until leaving and adjusted in the final settlement (default — today's behaviour)
 *  - next_bill:   automatically adjusted once, against the first monthly bill after the joining month
 *  - manual:      only when an operator applies it (deposit "apply to due", with the month recorded)
 */
export const ADVANCE_ADJUSTMENT_RULES = ["on_checkout", "next_bill", "manual"] as const;
export type AdvanceAdjustmentRule = (typeof ADVANCE_ADJUSTMENT_RULES)[number];

/**
 * How the joining month is charged when the member joins after the 1st:
 *  - full:       the full monthly dining charge
 *  - prorate:    charge only the remaining days of the month
 *  - next_month: nothing for the joining month — billing starts on the 1st of the next month
 */
export const PRORATION_MODES = ["full", "prorate", "next_month"] as const;
export type ProrationMode = (typeof PRORATION_MODES)[number];

/** Mess SMS events — each has its own on/off toggle and editable template in Mess Settings. */
export const MESS_SMS_EVENTS = ["payment", "bill", "dueReminder", "admission", "checkout"] as const;
export type MessSmsEvent = (typeof MESS_SMS_EVENTS)[number];

export const MESS_SMS_PLACEHOLDERS = [
  "studentName",
  "messName",
  "amount",
  "paymentDate",
  "receiptNo",
  "billingMonth",
  "previousDue",
  "remainingDue",
  "paymentMethod",
  "dueDate",
  "totalPayable",
] as const;

export const DEFAULT_MESS_SMS_TEMPLATES: Record<MessSmsEvent, string> = {
  payment: "প্রিয় {{studentName}}, {{messName}}-এ ৳{{amount}} পেমেন্ট গৃহীত হয়েছে ({{paymentMethod}}, {{paymentDate}})। রসিদ: {{receiptNo}}। বর্তমান বকেয়া: ৳{{remainingDue}}।",
  bill: "প্রিয় {{studentName}}, {{messName}}-এর {{billingMonth}} মাসের বিল ৳{{amount}}। পূর্বের বকেয়া ৳{{previousDue}}, মোট প্রদেয় ৳{{totalPayable}}। শেষ তারিখ {{dueDate}}।",
  dueReminder: "প্রিয় {{studentName}}, {{messName}}-এ আপনার বকেয়া ৳{{remainingDue}}। অনুগ্রহ করে {{dueDate}}-এর মধ্যে পরিশোধ করুন।",
  admission: "প্রিয় {{studentName}}, {{messName}}-এ আপনার ভর্তি সম্পন্ন হয়েছে। পরিশোধ ৳{{amount}} (রসিদ {{receiptNo}}), বাকি ৳{{remainingDue}}।",
  checkout: "প্রিয় {{studentName}}, {{messName}} থেকে আপনার চেক-আউট সম্পন্ন হয়েছে। চূড়ান্ত হিসাব: ৳{{amount}}।",
};

export const DEPOSIT_TX_TYPES = ["deduct", "apply_to_due", "refund"] as const;
export type DepositTxType = (typeof DEPOSIT_TX_TYPES)[number];
export const DEPOSIT_TX_STATUS = ["pending", "approved", "completed", "rejected", "cancelled"] as const;
export type DepositTxStatus = (typeof DEPOSIT_TX_STATUS)[number];

export const SETTLEMENT_STATUS = ["pending", "approved", "completed", "cancelled"] as const;

export const EXPENSE_STATUS = ["pending", "approved", "rejected", "cancelled"] as const;

export const COMPLAINT_KINDS = ["complaint", "maintenance"] as const;
export const COMPLAINT_PRIORITY = ["low", "normal", "high", "urgent"] as const;
export const COMPLAINT_STATUS = ["open", "in_progress", "waiting", "resolved", "closed"] as const;

export const MESS_NOTICE_TYPES = ["payment_reminder", "rent_due", "general", "maintenance", "emergency", "renewal_leaving"] as const;
export const MESS_NOTICE_AUDIENCE = ["mess", "member"] as const;

export const DEFAULT_ROOM_TYPES = ["সিঙ্গেল", "ডাবল", "ট্রিপল", "ডরমেটরি"];
export const DEFAULT_SEAT_TYPES = ["সাধারণ", "জানালার পাশে", "প্রিমিয়াম"];
export const DEFAULT_EXPENSE_CATEGORIES = [
  "বাড়ি / মেস ভাড়া",
  "গ্যাস",
  "বিদ্যুৎ",
  "পানি",
  "ইন্টারনেট",
  "পরিচ্ছন্নতা",
  "রক্ষণাবেক্ষণ",
  "স্টাফ বেতন",
  "নিরাপত্তা",
  "আসবাবপত্র",
  "সরঞ্জাম",
  "অন্যান্য",
];
export const DEFAULT_COMPLAINT_CATEGORIES = ["রুম", "খাবার/রান্নাঘর", "পরিচ্ছন্নতা", "নিরাপত্তা", "আচরণ", "অন্যান্য"];
export const DEFAULT_MAINTENANCE_CATEGORIES = ["রুম রক্ষণাবেক্ষণ", "আসবাবপত্র মেরামত", "বৈদ্যুতিক", "প্লাম্বিং", "পরিচ্ছন্নতা", "অন্যান্য"];
