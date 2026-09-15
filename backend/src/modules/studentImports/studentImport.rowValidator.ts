import { Types } from "mongoose";
import { Course } from "../courses/course.model";
import { Student } from "../students/student.model";
import { PaymentMethod } from "../paymentMethods/paymentMethod.model";
import { getSettings } from "../settings/settings.service";
import type { ParsedRowResult } from "./studentImport.excel";
import type { ParsedStudentRow } from "./studentImportRow.model";

/**
 * Bulk Student Upload — row-content business validation (§11/§12/§28 of the
 * spec). Runs once, batched, over every row in the file at upload time
 * (never one query per row — §32) and is run AGAIN, per-row, at approval
 * time against fresh data (studentImport.service.ts's approveRow) since a
 * row VALID at preview time is not guaranteed to still be valid later
 * (another row may have just been approved with the same phone, a Course
 * may have been deactivated, etc — §12).
 */
export interface ValidatedRow {
  rowNumber: number;
  parsed: ParsedStudentRow;
  status: "VALID" | "WARNING" | "ERROR";
  messages: string[];
  duplicateInFile: boolean;
  matchesExistingStudentId?: string;
}

interface CourseLookupEntry {
  id: string;
  name: string;
  status: string;
}

async function loadCourseLookup(): Promise<Map<string, CourseLookupEntry[]>> {
  const courses = await Course.find({}).select("name status");
  const map = new Map<string, CourseLookupEntry[]>();
  for (const c of courses) {
    const key = c.name.trim().toLowerCase();
    const arr = map.get(key) || [];
    arr.push({ id: String(c._id), name: c.name, status: c.status });
    map.set(key, arr);
  }
  return map;
}

function resolveCourse(courseName: string | undefined, lookup: Map<string, CourseLookupEntry[]>): { courseId?: string; message?: string; level?: "ERROR" | "WARNING" } {
  if (!courseName) return {};
  const candidates = lookup.get(courseName.trim().toLowerCase()) || [];
  if (candidates.length === 0) {
    return { message: `কোর্স "${courseName}" Settings-এ পাওয়া যায়নি — নতুন কোর্স স্বয়ংক্রিয়ভাবে তৈরি হবে না।`, level: "ERROR" };
  }
  const active = candidates.filter((c) => c.status === "সক্রিয়");
  if (active.length === 1) return { courseId: active[0].id };
  if (active.length > 1) {
    return { message: `কোর্স "${courseName}" নামে একাধিক সক্রিয় কোর্স পাওয়া গেছে — কোনটি বোঝানো হয়েছে তা নিশ্চিত করা যায়নি।`, level: "ERROR" };
  }
  // Only inactive matches exist.
  return { message: `কোর্স "${courseName}" নিষ্ক্রিয় — সক্রিয় করুন অথবা সঠিক কোর্স ব্যবহার করুন।`, level: "ERROR" };
}

export async function validateParsedRows(parsedRows: ParsedRowResult[]): Promise<ValidatedRow[]> {
  const [courseLookup, settings, activePaymentMethods] = await Promise.all([
    loadCourseLookup(),
    getSettings(),
    PaymentMethod.find({ status: "সক্রিয়" }).select("name"),
  ]);
  const activeMethodNames = new Set(activePaymentMethods.map((m) => m.name));

  const phones = Array.from(new Set(parsedRows.map((r) => r.parsed.phone).filter((p): p is string => !!p)));
  const existingByPhone = new Map<string, string>();
  if (phones.length > 0) {
    const matches = await Student.find({ phone: { $in: phones } }).select("phone");
    for (const m of matches) existingByPhone.set(m.phone, String(m._id));
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
  for (const r of parsedRows) {
    if (r.parsed.phone) phoneRowCount.set(r.parsed.phone, (phoneRowCount.get(r.parsed.phone) || 0) + 1);
    if (r.parsed.rollNumber) rollRowCount.set(r.parsed.rollNumber, (rollRowCount.get(r.parsed.rollNumber) || 0) + 1);
  }

  return parsedRows.map((row) => {
    const messages: string[] = [...row.parseErrors];
    const warnings: string[] = [...row.parseWarnings];
    let hasError = row.parseErrors.length > 0;
    let duplicateInFile = false;
    let matchesExistingStudentId: string | undefined;

    const parsed: ParsedStudentRow = { ...row.parsed };

    const courseResult = resolveCourse(row.parsed.courseName, courseLookup);
    if (courseResult.courseId) parsed.courseId = courseResult.courseId;
    if (courseResult.message) {
      if (courseResult.level === "ERROR") { messages.push(courseResult.message); hasError = true; }
      else warnings.push(courseResult.message);
    }

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

    if (parsed.paid !== undefined && parsed.paid < 0) { messages.push('"ভর্তির সময় প্রদান" ঋণাত্মক হতে পারে না।'); hasError = true; }
    if (parsed.discount !== undefined && parsed.discount < 0) { messages.push('"ছাড়" ঋণাত্মক হতে পারে না।'); hasError = true; }
    if (parsed.paid && parsed.paid > 0) {
      if (!parsed.paymentMethod) { messages.push('"ভর্তির সময় প্রদান" থাকলে "পেমেন্ট মাধ্যম" আবশ্যক।'); hasError = true; }
      else if (!activeMethodNames.has(parsed.paymentMethod)) {
        messages.push(`পেমেন্ট মাধ্যম "${parsed.paymentMethod}" সক্রিয় তালিকায় নেই।`);
        hasError = true;
      }
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
 * whole file's. Returns a plain error message (or undefined if still
 * valid) rather than a full ValidatedRow — approval either proceeds or it
 * doesn't.
 */
export async function revalidateRowForApproval(parsed: ParsedStudentRow): Promise<string | undefined> {
  if (!parsed.name || !parsed.phone || !parsed.dob || !parsed.rollNumber || !parsed.guardianMobile) {
    return "আবশ্যক তথ্য অনুপস্থিত।";
  }
  if (!parsed.courseId || !Types.ObjectId.isValid(parsed.courseId)) return "কোর্স নির্বাচিত নেই।";
  const course = await Course.findById(parsed.courseId).select("status");
  if (!course) return "নির্বাচিত কোর্সটি আর পাওয়া যাচ্ছে না।";
  if (course.status !== "সক্রিয়") return "নির্বাচিত কোর্সটি নিষ্ক্রিয়।";

  const existingPhone = await Student.exists({ phone: parsed.phone });
  if (existingPhone) return `"${parsed.phone}" মোবাইল নম্বরের একজন শিক্ষার্থী ইতোমধ্যে বিদ্যমান।`;

  const settings = await getSettings();
  if (settings.rollNumberScope === "global") {
    const existingRoll = await Student.exists({ currentRollNumber: parsed.rollNumber });
    if (existingRoll) return `রোল/রেজিস্ট্রেশন নম্বর "${parsed.rollNumber}" ইতোমধ্যে ব্যবহৃত হয়েছে।`;
  }

  if (parsed.paid !== undefined && parsed.paid < 0) return '"ভর্তির সময় প্রদান" ঋণাত্মক হতে পারে না।';
  if (parsed.discount !== undefined && parsed.discount < 0) return '"ছাড়" ঋণাত্মক হতে পারে না।';
  if (parsed.paid && parsed.paid > 0 && !parsed.paymentMethod) return '"ভর্তির সময় প্রদান" থাকলে "পেমেন্ট মাধ্যম" আবশ্যক।';

  return undefined;
}
