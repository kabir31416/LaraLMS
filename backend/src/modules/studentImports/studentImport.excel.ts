import * as XLSX from "xlsx";
import { RELATIONS } from "../students/student.constants";
import { toAsciiDigits } from "../../common/utils/digits";
import type { ParsedStudentRow } from "./studentImportRow.model";

/**
 * Bulk Student Upload — Excel parsing (§2/§18/§24 of the spec).
 *
 * Column mapping is by HEADER TEXT, never column position/order (§24) — a
 * reordered or partially-filled sheet still parses correctly as long as the
 * header row uses these exact labels (the generated template is the only
 * source of these headers, so "download the template, don't retype the
 * headers" is the expected workflow).
 *
 * Reuses the same `xlsx` (SheetJS) package this app's frontend already uses
 * for Excel *export* (`src/lib/exporters.ts`) — `exceljs` is also a backend
 * dependency but has never been used anywhere in this codebase and cannot
 * read the legacy binary `.xls` format the spec asks to support, so `xlsx`
 * is the correct existing-library choice here, not exceljs.
 */

export interface ColumnDef {
  header: string;
  field: keyof ParsedStudentRow;
  required: boolean;
  kind: "text" | "phone" | "date" | "number" | "relation";
}

export const COLUMN_DEFINITIONS: ColumnDef[] = [
  { header: "নাম", field: "name", required: true, kind: "text" },
  { header: "মোবাইল", field: "phone", required: true, kind: "phone" },
  { header: "জন্ম তারিখ (yyyy-mm-dd)", field: "dob", required: true, kind: "date" },
  { header: "রেজিস্ট্রেশন/পূর্বের রোল", field: "rollNumber", required: true, kind: "text" },
  { header: "কোর্স", field: "courseName", required: true, kind: "text" },
  { header: "অভিভাবকের মোবাইল", field: "guardianMobile", required: true, kind: "phone" },
  { header: "অভিভাবকের নাম", field: "guardianName", required: false, kind: "text" },
  { header: "অভিভাবকের সম্পর্ক", field: "guardianRelation", required: false, kind: "relation" },
  { header: "অভিভাবকের পেশা", field: "guardianOccupation", required: false, kind: "text" },
  { header: "রক্তের গ্রুপ", field: "bloodGroup", required: false, kind: "text" },
  { header: "বর্তমান ঠিকানা", field: "presentAddress", required: false, kind: "text" },
  { header: "স্থায়ী ঠিকানা", field: "permanentAddress", required: false, kind: "text" },
  { header: "HSC প্রতিষ্ঠান", field: "hscInstitution", required: false, kind: "text" },
  { header: "HSC বোর্ড", field: "hscBoard", required: false, kind: "text" },
  { header: "HSC পাসের বছর", field: "hscPassingYear", required: false, kind: "text" },
  { header: "HSC গ্রুপ", field: "hscGroup", required: false, kind: "text" },
  { header: "HSC জিপিএ", field: "hscGpa", required: false, kind: "text" },
  { header: "SSC প্রতিষ্ঠান", field: "sscInstitution", required: false, kind: "text" },
  { header: "SSC বোর্ড", field: "sscBoard", required: false, kind: "text" },
  { header: "SSC পাসের বছর", field: "sscPassingYear", required: false, kind: "text" },
  { header: "SSC গ্রুপ", field: "sscGroup", required: false, kind: "text" },
  { header: "SSC জিপিএ", field: "sscGpa", required: false, kind: "text" },
  { header: "ভর্তির সময় প্রদান (৳)", field: "paid", required: false, kind: "number" },
  { header: "ছাড় (৳)", field: "discount", required: false, kind: "number" },
  { header: "পেমেন্ট মাধ্যম", field: "paymentMethod", required: false, kind: "text" },
];

export const MAX_IMPORT_ROWS = 1000;

function normalizeText(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
}

/**
 * Excel silently drops a phone number's leading zero when the cell is
 * stored as a number rather than text (§18) — "01712345678" becomes
 * 1712345678. If a 10-digit number comes through, it's almost certainly
 * this exact case for a Bangladeshi mobile number, so it's restored with a
 * warning rather than silently accepted as-is or hard-rejected outright.
 */
function normalizePhone(v: unknown): { value?: string; warning?: string } {
  const wasNumber = typeof v === "number";
  const raw = normalizeText(v);
  if (!raw) return {};
  let value = toAsciiDigits(raw).replace(/[^\d]/g, "");
  let warning: string | undefined;
  if (wasNumber && value.length === 10) {
    value = `0${value}`;
    warning = "মোবাইল নম্বরের শুরুতে '০' স্বয়ংক্রিয়ভাবে যোগ করা হয়েছে — Excel এটি সংখ্যা হিসেবে সংরক্ষণ করেছিল। অনুগ্রহ করে যাচাই করুন।";
  }
  return { value, warning };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Accepts a JS Date (Excel date-formatted cell) or a handful of common typed-string formats — never guesses beyond these. */
function normalizeDob(v: unknown): { value?: string; error?: string } {
  if (v === null || v === undefined || v === "") return {};
  if (v instanceof Date && !isNaN(v.getTime())) {
    return { value: `${v.getFullYear()}-${pad2(v.getMonth() + 1)}-${pad2(v.getDate())}` };
  }
  const raw = normalizeText(v);
  if (!raw) return {};
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw);
  if (isoMatch) return { value: `${isoMatch[1]}-${pad2(Number(isoMatch[2]))}-${pad2(Number(isoMatch[3]))}` };
  const dmyMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(raw);
  if (dmyMatch) return { value: `${dmyMatch[3]}-${pad2(Number(dmyMatch[2]))}-${pad2(Number(dmyMatch[1]))}` };
  return { error: `"জন্ম তারিখ" সঠিক ফরম্যাটে নেই (yyyy-mm-dd দিন): "${raw}"` };
}

function normalizeNumber(v: unknown): { value?: number; error?: string } {
  if (v === null || v === undefined || v === "") return {};
  const n = typeof v === "number" ? v : Number(toAsciiDigits(String(v)).trim());
  if (Number.isNaN(n)) return { error: `সংখ্যা প্রত্যাশিত ছিল, পাওয়া গেছে: "${String(v)}"` };
  return { value: n };
}

function normalizeRelation(v: unknown): { value?: string; warning?: string } {
  const raw = normalizeText(v);
  if (!raw) return {};
  const match = RELATIONS.find((r) => r === raw);
  if (match) return { value: match };
  return { value: raw, warning: `"অভিভাবকের সম্পর্ক" এর মান "${raw}" পরিচিত তালিকায় নেই (${RELATIONS.join(", ")}) — "অন্যান্য" হিসেবে গণ্য হবে` };
}

export interface ParsedRowResult {
  rowNumber: number;
  raw: Record<string, string>;
  parsed: ParsedStudentRow;
  parseErrors: string[];
  parseWarnings: string[];
}

export interface ParseWorkbookResult {
  rows: ParsedRowResult[];
  headerErrors: string[];
}

/** Reads the uploaded buffer once, fully in memory — nothing is written to disk (see studentImportSession.model.ts's file-level comment for why). */
export function parseStudentWorkbook(buffer: Buffer): ParseWorkbookResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { rows: [], headerErrors: ["এক্সেল ফাইলে কোনো শিট পাওয়া যায়নি।"] };
  const sheet = workbook.Sheets[sheetName];
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });

  if (records.length === 0) return { rows: [], headerErrors: ["এক্সেল ফাইলে কোনো ডেটা পাওয়া যায়নি।"] };

  // The generated template suffixes required headers with " *" as a visual marker (buildImportTemplateBuffer
  // below) — that suffix must be stripped before matching against COLUMN_DEFINITIONS' bare header strings,
  // both for presence-checking and for reading each cell's value out of the parsed record.
  const headerLookup = new Map<string, string>(); // COLUMN_DEFINITIONS.header -> actual key in `record`
  for (const key of Object.keys(records[0])) {
    const bare = key.trim().replace(/\s*\*$/, "");
    headerLookup.set(bare, key);
  }
  const headerErrors: string[] = [];
  for (const col of COLUMN_DEFINITIONS) {
    if (col.required && !headerLookup.has(col.header)) {
      headerErrors.push(`আবশ্যক কলাম পাওয়া যায়নি: "${col.header}" — টেমপ্লেট ডাউনলোড করে সঠিক কলাম হেডার ব্যবহার করুন।`);
    }
  }
  if (headerErrors.length > 0) return { rows: [], headerErrors };

  const rows: ParsedRowResult[] = records.map((record, idx) => {
    const parsed: ParsedStudentRow = {};
    const raw: Record<string, string> = {};
    const parseErrors: string[] = [];
    const parseWarnings: string[] = [];

    for (const col of COLUMN_DEFINITIONS) {
      const actualKey = headerLookup.get(col.header);
      const cell = actualKey === undefined ? undefined : record[actualKey];
      raw[col.header] = cell === null || cell === undefined ? "" : String(cell instanceof Date ? cell.toISOString() : cell);

      let fieldHadError = false;
      if (col.kind === "phone") {
        const { value, warning } = normalizePhone(cell);
        if (value) (parsed[col.field] as string) = value;
        if (warning) parseWarnings.push(warning);
      } else if (col.kind === "date") {
        const { value, error } = normalizeDob(cell);
        if (value) (parsed[col.field] as string) = value;
        if (error) { parseErrors.push(error); fieldHadError = true; }
      } else if (col.kind === "number") {
        const { value, error } = normalizeNumber(cell);
        if (value !== undefined) (parsed[col.field] as number) = value;
        if (error) { parseErrors.push(`"${col.header}": ${error}`); fieldHadError = true; }
      } else if (col.kind === "relation") {
        const { value, warning } = normalizeRelation(cell);
        if (value) (parsed[col.field] as string) = value;
        if (warning) parseWarnings.push(warning);
      } else {
        const value = normalizeText(cell);
        if (value) (parsed[col.field] as string) = value;
      }

      if (col.required && !parsed[col.field] && !fieldHadError) {
        parseErrors.push(`"${col.header}" আবশ্যক — খালি রাখা যাবে না।`);
      }
    }

    return { rowNumber: idx + 2, raw, parsed, parseErrors, parseWarnings }; // +2: header is row 1, data starts at row 2
  });

  return { rows, headerErrors: [] };
}

/** Builds the downloadable .xlsx template — header row (required columns marked) plus one example row. Phone columns are pre-formatted as Text so a future re-upload can't lose a leading zero the way a fresh, unformatted cell can (§18). */
export function buildImportTemplateBuffer(): Buffer {
  const headers = COLUMN_DEFINITIONS.map((c) => (c.required ? `${c.header} *` : c.header));
  const example = [
    "রহিম উদ্দিন", "01712345678", "2005-01-15", "১২", "BSc Nursing", "01898765432",
    "করিম উদ্দিন", "পিতা", "ব্যবসায়ী", "B+", "ঢাকা", "ঢাকা",
    "", "", "", "", "", "", "", "", "", "",
    "1000", "0", "নগদ",
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws["!cols"] = COLUMN_DEFINITIONS.map((c) => ({ wch: Math.max(14, c.header.length) }));
  // Force phone columns to Text format so re-typing/pasting a number into them doesn't strip a leading zero.
  COLUMN_DEFINITIONS.forEach((col, i) => {
    if (col.kind !== "phone") return;
    const colLetter = XLSX.utils.encode_col(i);
    for (let r = 2; r <= 200; r++) {
      const addr = `${colLetter}${r}`;
      if (!ws[addr]) ws[addr] = { t: "s", v: "" };
      ws[addr].z = "@";
    }
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Students");

  const notesWs = XLSX.utils.aoa_to_sheet([
    ["নির্দেশনা"],
    ["* চিহ্নিত কলামগুলো আবশ্যক — খালি রাখা যাবে না।"],
    ["কোর্সের নাম অবশ্যই Settings-এ বিদ্যমান কোনো কোর্সের নামের সাথে হুবহু মিলতে হবে — নতুন কোর্স স্বয়ংক্রিয়ভাবে তৈরি হবে না।"],
    ["মোবাইল নম্বর কলামগুলো Text ফরম্যাটে রাখুন যাতে শুরুর '০' মুছে না যায়।"],
    ["জন্ম তারিখ yyyy-mm-dd ফরম্যাটে দিন (যেমন: 2005-01-15)।"],
    ["কোর্স ফি ও ভর্তি ফি এক্সেল থেকে নেওয়া হয় না — সবসময় Settings-এর বর্তমান কনফিগারেশন থেকে আসে।"],
    ["\"ভর্তির সময় প্রদান\" খালি রাখলে কোনো পেমেন্ট তৈরি হবে না।"],
  ]);
  XLSX.utils.book_append_sheet(wb, notesWs, "নির্দেশনা");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
