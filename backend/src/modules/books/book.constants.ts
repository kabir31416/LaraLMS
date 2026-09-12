/** Mirrors the frontend's `types/book.ts` string unions exactly — same reasoning as student.constants.ts. */
export const ISSUE_STATUS = ["ইস্যু", "আংশিক ফেরত", "ফেরত"] as const;

export const STOCK_HISTORY_ACTIONS = [
  "স্টক যোগ",
  "স্টক কমানো",
  "ব্রাঞ্চে স্থানান্তর",
  "শিক্ষার্থীকে বিতরণ",
  "শিক্ষার্থী থেকে ফেরত",
] as const;
