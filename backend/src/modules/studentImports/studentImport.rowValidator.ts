import { Types } from "mongoose";
import { Course } from "../courses/course.model";
import { Student } from "../students/student.model";
import { HscInstitution } from "../hscInstitutions/hscInstitution.model";
import { getSettings } from "../settings/settings.service";
import type { ParsedRowResult } from "./studentImport.excel";
import type { ParsedStudentRow } from "./studentImportRow.model";

/**
 * Bulk Student Upload — row-content business validation (Excel Student
 * Information Import spec §11/§12/§13/§28). Runs once, batched, over every
 * row in the file at upload time (never one query per row — §32) and is run
 * AGAIN, per-row, at approval time against fresh data
 * (studentImport.service.ts's approveRow) since a row VALID at preview time
 * is not guaranteed to still be valid later (another row may have just been
 * approved with the same phone, the selected Course may have been
 * deactivated, etc — §12).
 *
 * FINAL BUSINESS RULE: EXCEL IMPORT = STUDENT INFORMATION ONLY. There is no
 * course resolution here at all — the admin selects the course once via the
 * UI before upload, it is validated a single time and stored on the session
 * (studentImport.service.ts's uploadAndPreview), and every row simply
 * inherits it. There is also no fee/payment validation — import never
 * creates a payment.
 */
export interface ValidatedRow {
  rowNumber: number;
  parsed: ParsedStudentRow;
  status: "VALID" | "WARNING" | "ERROR";
  messages: string[];
  duplicateInFile: boolean;
  matchesExistingStudentId?: string;
}

/** Trim + collapse whitespace + lowercase — must match hscInstitution.service.ts's own normalize() exactly, since this only reads that collection's normalizedName key. */
function normalizeInstitutionName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function validateParsedRows(parsedRows: ParsedRowResult[]): Promise<ValidatedRow[]> {
  const settings = await getSettings();

  // Informational only (§8 of the spec) — a row whose HSC institution isn't
  // yet in the master data is still fully approvable; it just becomes a new
  // institution record at approval time (student.service.ts's
  // syncHscInstitution), never here at preview/validation time.
  const institutionNames = Array.from(
    new Set(parsedRows.map((r) => r.parsed.hscInstitution).filter((n): n is string => !!n && n.trim().length > 0)),
  );
  const knownInstitutionNames = new Set<string>();
  if (institutionNames.length > 0) {
    const normalizedNames = institutionNames.map(normalizeInstitutionName);
    const matches = await HscInstitution.find({ normalizedName: { $in: normalizedNames } }).select("normalizedName");
    for (const m of matches) knownInstitutionNames.add(m.normalizedName);
  }

  const phones = Array.from(new Set(parsedRows.map((r) => r.parsed.phone).filter((p): p is string => !!p)));
  const existingByPhone = new Map<string, string>();
  if (phones.length > 0) {
    const matches = await Student.find({ phone: { $in: phones } }).select("phone");
    for (const m of matches) existingByPhone.set(m.phone, String(m._id));
  }

  // registrationNumber (new-format "Coaching Reg No") becomes Student.registrationId
  // directly (studentImport.service.ts's buildStudentCreateBody) — must be
  // checked for uniqueness against existing students the same way phone is,
  // never left to fail only as a raw Mongo duplicate-key error at approval time.
  const registrationNumbers = Array.from(
    new Set(parsedRows.map((r) => r.parsed.registrationNumber).filter((n): n is string => !!n)),
  );
  const existingByRegistrationNumber = new Map<string, string>();
  if (registrationNumbers.length > 0) {
    const matches = await Student.find({ registrationId: { $in: registrationNumbers } }).select("registrationId");
    for (const m of matches) existingByRegistrationNumber.set(m.registrationId, String(m._id));
  }

  let existingByRoll = new Map<string, string>();
  if (settings.rollNumberScope === "global") {
    const rolls = Array.from(new Set(parsedRows.map((r) => r.parsed.rollNumber).filter((r): r is string => !!r)));
    if (rolls.length > 0) {
      const matches = await Student.find({ currentRollNumber: { $in: rolls } }).select("currentRollNumber");
      existingByRoll = new Map(matches.map((m) => [m.currentRollNumber as string, String(m._id)]));
    }
  }

  const phoneRowCount = new Map<string, number>();
  const rollRowCount = new Map<string, number>();
  const registrationNumberRowCount = new Map<string, number>();
  for (const r of parsedRows) {
    if (r.parsed.phone) phoneRowCount.set(r.parsed.phone, (phoneRowCount.get(r.parsed.phone) || 0) + 1);
    if (r.parsed.rollNumber) rollRowCount.set(r.parsed.rollNumber, (rollRowCount.get(r.parsed.rollNumber) || 0) + 1);
    if (r.parsed.registrationNumber) registrationNumberRowCount.set(r.parsed.registrationNumber, (registrationNumberRowCount.get(r.parsed.registrationNumber) || 0) + 1);
  }

  return parsedRows.map((row) => {
    const messages: string[] = [...row.parseErrors];
    const warnings: string[] = [...row.parseWarnings];
    let hasError = row.parseErrors.length > 0;
    let duplicateInFile = false;
    let matchesExistingStudentId: string | undefined;

    const parsed: ParsedStudentRow = { ...row.parsed };

    if (row.parsed.phone) {
      if ((phoneRowCount.get(row.parsed.phone) || 0) > 1) {
        duplicateInFile = true;
        messages.push(`মোবাইল নম্বর "${row.parsed.phone}" এই ফাইলের মধ্যেই একাধিকবার আছে।`);
        hasError = true;
      }
      const existingId = existingByPhone.get(row.parsed.phone);
      if (existingId) {
        matchesExistingStudentId = existingId;
        messages.push(`"${row.parsed.phone}" মোবাইল নম্বরের একজন শিক্ষার্থী ইতোমধ্যে বিদ্যমান।`);
        hasError = true;
      }
    }

    if (row.parsed.registrationNumber) {
      if ((registrationNumberRowCount.get(row.parsed.registrationNumber) || 0) > 1) {
        duplicateInFile = true;
        messages.push(`রেজিস্ট্রেশন নম্বর "${row.parsed.registrationNumber}" এই ফাইলের মধ্যেই একাধিকবার আছে।`);
        hasError = true;
      }
      const existingRegId = existingByRegistrationNumber.get(row.parsed.registrationNumber);
      if (existingRegId && existingRegId !== matchesExistingStudentId) {
        matchesExistingStudentId = matchesExistingStudentId || existingRegId;
        messages.push(`রেজিস্ট্রেশন নম্বর "${row.parsed.registrationNumber}" ইতোমধ্যে ব্যবহৃত হয়েছে।`);
        hasError = true;
      }
    }

    if (row.parsed.rollNumber) {
      if ((rollRowCount.get(row.parsed.rollNumber) || 0) > 1) {
        duplicateInFile = true;
        warnings.push(`রোল/রেজিস্ট্রেশন নম্বর "${row.parsed.rollNumber}" এই ফাইলের মধ্যেই একাধিকবার আছে।`);
      }
      const existingRollId = existingByRoll.get(row.parsed.rollNumber);
      if (existingRollId && existingRollId !== matchesExistingStudentId) {
        messages.push(`রোল/রেজিস্ট্রেশন নম্বর "${row.parsed.rollNumber}" ইতোমধ্যে ব্যবহৃত হয়েছে (গ্লোবাল রোল স্কোপ)।`);
        hasError = true;
      }
    }

    if (parsed.hscInstitution && parsed.hscInstitution.trim() && !knownInstitutionNames.has(normalizeInstitutionName(parsed.hscInstitution))) {
      warnings.push(`"${parsed.hscInstitution}" নতুন HSC প্রতিষ্ঠান হিসেবে যুক্ত হবে (অনুমোদনের সময়)।`);
    }

    // Guardian.phone is a required field at the DB level (guardian.model.ts)
    // — other guardian details without a phone are still fully importable
    // (§5/§28: guardian fields are optional), guardian.service.ts's
    // upsertPrimaryFromInlineFields simply skips creating a Guardian record
    // in that case, so this is informational, never blocking.
    if ((parsed.guardianName || parsed.guardianRelation || parsed.guardianOccupation) && !parsed.guardianMobile) {
      warnings.push("অভিভাবকের মোবাইল নম্বর ছাড়া অভিভাবকের তথ্য সংরক্ষণ করা হবে না — পরে যোগ করা যাবে।");
    }

    const status: ValidatedRow["status"] = hasError ? "ERROR" : warnings.length > 0 ? "WARNING" : "VALID";
    return {
      rowNumber: row.rowNumber,
      parsed,
      status,
      messages: [...messages, ...warnings],
      duplicateInFile,
      matchesExistingStudentId,
    };
  });
}

/**
 * Re-run at approval time for exactly one row (studentImport.service.ts's
 * approveRow) — a lightweight single-row version of the same rules, since
 * by then only one row's fresh state actually needs checking, not the
 * whole file's. `courseId` is the session's admin-selected course (never
 * read from the row itself — course assignment has exactly one source,
 * per the spec's "course/batch mismatch must be structurally impossible").
 * Returns a plain error message (or undefined if still valid) rather than a
 * full ValidatedRow — approval either proceeds or it doesn't.
 */
export async function revalidateRowForApproval(parsed: ParsedStudentRow, courseId: string): Promise<string | undefined> {
  if (!parsed.name || !parsed.phone) return "আবশ্যক তথ্য অনুপস্থিত (নাম/মোবাইল)।";
  if (!Types.ObjectId.isValid(courseId)) return "কোর্স নির্বাচিত নেই।";
  const course = await Course.findById(courseId).select("status");
  if (!course) return "নির্বাচিত কোর্সটি আর পাওয়া যাচ্ছে না।";
  if (course.status !== "সক্রিয়") return "নির্বাচিত কোর্সটি নিষ্ক্রিয়।";

  const existingPhone = await Student.exists({ phone: parsed.phone });
  if (existingPhone) return `"${parsed.phone}" মোবাইল নম্বরের একজন শিক্ষার্থী ইতোমধ্যে বিদ্যমান।`;

  if (parsed.registrationNumber) {
    const existingRegistration = await Student.exists({ registrationId: parsed.registrationNumber });
    if (existingRegistration) return `রেজিস্ট্রেশন নম্বর "${parsed.registrationNumber}" ইতোমধ্যে ব্যবহৃত হয়েছে।`;
  }

  const settings = await getSettings();
  if (settings.rollNumberScope === "global" && parsed.rollNumber) {
    const existingRoll = await Student.exists({ currentRollNumber: parsed.rollNumber });
    if (existingRoll) return `রোল/রেজিস্ট্রেশন নম্বর "${parsed.rollNumber}" ইতোমধ্যে ব্যবহৃত হয়েছে।`;
  }

  return undefined;
}
