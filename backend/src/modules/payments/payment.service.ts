import { Request } from "express";
import { Types } from "mongoose";
import { Payment, PaymentDoc } from "./payment.model";
import { Student } from "../students/student.model";
import { Branch } from "../branches/branch.model";
import * as accountsService from "../accounts/accounts.service";
import { ApiError } from "../../common/utils/ApiError";
import { recordAudit } from "../../audit/auditLog.service";
import { buildMeta, buildSearchFilter, parsePagination } from "../../common/utils/pagination";
import { generateReceiptNumber } from "../../common/utils/idGenerators";
import { logger } from "../../logger/logger";

function isDuplicateKeyError(err: unknown): boolean {
  return !!err && typeof err === "object" && (err as { code?: number }).code === 11000;
}

/**
 * Shared by list() and stats() below (Fees/Payment audit §5/§13 — Reports'
 * own Fee Collection totals must use this exact same filter, never a
 * re-derived one) so a course/batch/date/method scope means the same thing
 * everywhere a Payment is being counted or summed.
 */
function buildPaymentFilter(req: Request): Record<string, unknown> {
  const filter: Record<string, unknown> = { ...buildSearchFilter(req.query.search, ["receiptNo"]) };
  if (req.query.studentId) filter.studentId = req.query.studentId;
  if (req.query.feeType) filter.feeType = req.query.feeType;
  if (req.query.method) filter.method = req.query.method;
  if (req.query.courseId) filter.courseId = req.query.courseId;
  if (req.query.batchId) filter.batchId = req.query.batchId;
  if (req.query.dateFrom || req.query.dateTo) {
    filter.date = {
      ...(req.query.dateFrom ? { $gte: req.query.dateFrom } : {}),
      ...(req.query.dateTo ? { $lte: req.query.dateTo } : {}),
    };
  }
  // Every consumer of this endpoint (Payment History, Fee Collection Report,
  // any future caller) gets a cancelled payment excluded by default — the
  // ONE place this is decided, so nothing downstream has to know the
  // `status` field exists just to avoid double-counting a voided
  // transaction. Payment History alone asks for `includeCancelled=true` so
  // admins can still see/audit a cancelled row (Fees/Payment audit §7/§8).
  if (req.query.includeCancelled !== "true") filter.status = { $ne: "cancelled" };
  return filter;
}

export async function list(req: Request) {
  const { page, limit, skip, sort } = parsePagination(req, { date: -1, createdAt: -1 });
  const filter = buildPaymentFilter(req);

  const [items, total] = await Promise.all([
    Payment.find(filter).sort(sort).skip(skip).limit(limit),
    Payment.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

/**
 * Reports' Fee Collection tab's totals (Fees/Payment audit §5) — a global
 * aggregate over EVERY matching payment, computed once in the database with
 * the exact same filter list() uses, instead of the frontend summing
 * whatever page of `/payments` it happened to fetch (which would silently
 * under-count once matching payments exceed that page size).
 */
export async function stats(req: Request): Promise<{ total: number; count: number; receiptCount: number }> {
  const filter = buildPaymentFilter(req);
  // Unlike Model.find() (list() above), aggregate()'s $match is sent to
  // MongoDB as-is — Mongoose never casts a query string to the schema's
  // ObjectId type for it (same gotcha attendance.service.ts's stats()
  // documents), so studentId/courseId/batchId must be cast by hand here or
  // a course/batch-scoped report would silently come back as all zeros.
  for (const key of ["studentId", "courseId", "batchId"]) {
    const value = filter[key];
    if (typeof value === "string" && Types.ObjectId.isValid(value)) filter[key] = new Types.ObjectId(value);
  }
  const [row] = await Payment.aggregate<{ total: number; count: number; receiptCount: number }>([
    { $match: filter },
    { $group: { _id: null, total: { $sum: "$paidAmount" }, count: { $sum: 1 }, receipts: { $addToSet: "$receiptNo" } } },
    { $project: { total: 1, count: 1, receiptCount: { $size: "$receipts" } } },
  ]);
  return row ?? { total: 0, count: 0, receiptCount: 0 };
}

export async function getById(id: string): Promise<PaymentDoc> {
  const doc = await Payment.findById(id);
  if (!doc) throw ApiError.notFound("Payment not found");
  return doc;
}

/**
 * Backs the dedicated print-ready Payment Receipt page (Coaching Reg No /
 * Roll vs System ID spec §20) — everything the receipt needs (student,
 * batch name, institution branding, and the due figures immediately
 * resulting from THIS payment) bundled into one response so the page works
 * from just a paymentId, including after a browser refresh. Reuses
 * student.service.ts's getById() (the same guardian-flattening read every
 * other Student read uses) and institution.service.ts's singleton settings
 * — no parallel student/institution-fetching logic is introduced here.
 */
export async function getReceipt(payment: PaymentDoc): Promise<Record<string, unknown>> {
  const studentService = await import("../students/student.service");
  const student = await studentService.getById(String(payment.studentId));

  let batchName: string | undefined;
  const batchId = (student as { currentBatchId?: unknown }).currentBatchId;
  if (batchId) {
    const { Batch } = await import("../batches/batch.model");
    const batch = await Batch.findById(batchId).select("name");
    batchName = batch?.name;
  }

  const institutionService = await import("../settings/institution.service");
  const institution = await institutionService.getInstitutionSettings();

  // The due figure immediately AFTER this specific payment — never the
  // student's live/current due, which would silently drift for an old
  // receipt once later payments are recorded (previousDue is this payment's
  // own immutable snapshot). A material payment never touches tuition due
  // at all (payment.service.ts's create()), so its "due" is simply
  // unchanged from the snapshot. A non-material payment's own `discount`
  // permanently reduced totalFee at the time it was created (see create()
  // above), on top of paidAmount reducing what's still owed — both must be
  // subtracted here or an old receipt for a discounted payment would show a
  // due higher than the student's real due ever was after it.
  const isMaterialPayment = payment.source === "material";
  const currentDue = typeof payment.previousDue === "number"
    ? (isMaterialPayment ? payment.previousDue : payment.previousDue - payment.paidAmount - payment.discount)
    : undefined;

  return { payment, student, batchName, currentDue, institution };
}

/**
 * A payment is a financial event, not an editable record — Phase 1 §6's fee
 * module review — so there is still no update, and no hard delete. A routine
 * correction is its own new payment (e.g. a negative adjustment via
 * discount), which keeps the receipt trail intact. The one exception is
 * cancel() below, for a genuinely wrong transaction that must stop counting
 * everywhere (Fees/Payment audit §7) — even that never rewrites this row's
 * own amount/discount/paidAmount, only flags it and reverses its effect on
 * the student.
 */
export async function create(
  req: Request,
  data: {
    studentId: string;
    date?: string;
    amount: number;
    discount: number;
    fine: number;
    method: string;
    feeType: string;
    month?: string;
    note?: string;
    source?: "admission" | "regular" | "material";
    admissionFeeComponent?: number;
    courseFeeComponent?: number;
    idempotencyKey?: string;
  },
): Promise<PaymentDoc> {
  // A retry of a submission already processed (double-click, browser/network
  // retry) — return the payment that was actually created instead of trying
  // to create a second one or erroring. Never keyed on studentId (a student
  // legitimately has many payments): only two requests sharing the exact
  // same client-generated key are ever treated as "the same attempt".
  if (data.idempotencyKey) {
    const existing = await Payment.findOne({ idempotencyKey: data.idempotencyKey });
    if (existing) return existing;
  }

  const student = await Student.findById(data.studentId);
  if (!student) throw ApiError.notFound("Student not found");

  const paymentMethodService = await import("../paymentMethods/paymentMethod.service");
  await paymentMethodService.assertActiveMethod(data.method);

  const paidAmount = data.amount - data.discount + data.fine;
  if (paidAmount < 0) throw ApiError.badRequest("Discount cannot exceed amount + fine");

  const previousDue = student.due;
  // Financial data integrity audit §4/§13 — the server re-checks the latest
  // Due immediately before writing the Payment (never trusts a stale due the
  // client may have read moments earlier) and rejects a transaction that
  // would take the student's paid total past their total fee. A material
  // payment (Coaching Material Inventory) never touches tuition due at all,
  // so it's exempt. Zero-cash "discount correction" payments (paidAmount===0,
  // Fees audit §1's worked example) remain allowed — this only rejects
  // paidAmount that's strictly greater than what's actually owed.
  const isMaterialPayment = data.source === "material";
  if (!isMaterialPayment && paidAmount > previousDue) {
    throw ApiError.badRequest(`পরিশোধের পরিমাণ (৳${paidAmount}) বর্তমান বকেয়ার (৳${previousDue}) চেয়ে বেশি হতে পারে না`);
  }
  const receiptNo = await generateReceiptNumber();
  let doc: PaymentDoc;
  try {
    doc = await Payment.create({
      ...data,
      receiptNo,
      date: data.date || new Date().toISOString().slice(0, 10),
      paidAmount,
      batchId: student.currentBatchId,
      courseId: student.courseId,
      previousDue,
      createdBy: req.user?.id,
    });
  } catch (err) {
    // Two near-simultaneous requests with the same idempotencyKey can both
    // pass the check above before either commits — the unique index is the
    // real guard; losing that race here means the other request already won
    // and fully applied its student due update, so return its result rather
    // than surfacing the raw duplicate-key error for what the user only
    // ever intended as one payment.
    if (data.idempotencyKey && isDuplicateKeyError(err)) {
      const existing = await Payment.findOne({ idempotencyKey: data.idempotencyKey });
      if (existing) return existing;
    }
    throw err;
  }

  // A material payment is a real fee-collection event but is NOT part of
  // tuition — the Coaching Material Inventory module (§6) reuses this
  // function purely to get a real receipt + Payment-history row, and must
  // never move the student's tuition due/paid/totalFee balance.
  if (!isMaterialPayment) {
    // A payment's own `discount` must permanently reduce the student's total
    // fee the exact same way admission-time discount does (student.service.ts's
    // computeFees/applyPatch) — everywhere else in this app, "discount" means
    // "the real price is this much less," not "count less cash for this one
    // receipt." Skipping this accumulation (the previous behavior) only
    // subtracted `discount` from THIS payment's paidAmount, leaving
    // student.discount — and therefore totalFee — unchanged; the discounted
    // amount then reappeared in `due` on every subsequent view. This is what
    // an imported student (whose discount was never captured at admission,
    // since bulk import creates no payment at all) hits the very first time
    // anyone tries to apply their real negotiated price via Add Payment.
    if (data.discount > 0) student.discount += data.discount;
    student.paid += paidAmount;
    // Fees/Payment audit §13 — ONE shared formula, reused from
    // student.service.ts rather than reimplemented here (the previous
    // inline duplicate of this exact formula was the two-copies risk the
    // audit called out).
    const studentService = await import("../students/student.service");
    const fees = studentService.computeFees({
      feeType: student.feeType,
      totalCourseFee: student.totalCourseFee,
      admissionFee: student.admissionFee,
      monthlyFee: student.monthlyFee,
      courseDuration: student.courseDuration,
      discount: student.discount,
      paid: student.paid,
    });
    student.totalFee = fees.totalFee;
    student.due = fees.due;
    await student.save();
  }

  await recordAudit({ req, action: "payment.create", module: "payments", targetCollection: "payments", targetId: String(doc._id), after: doc.toObject() });

  // Best-effort mirror into the accounting ledger (Modules 23-24) — replaces
  // the old client-side AccountsAutoBridge, which only fired if someone
  // happened to have the Accounts page open. Never blocks the payment
  // itself: a fresh install with no Branch yet just skips this until one
  // exists, and the (source, refId) unique index makes a retry a no-op.
  // A material payment goes through this exact same universal mirror as
  // every other fee type — no new branch-specific logic is introduced here.
  try {
    const defaultBranch = await Branch.findOne().sort({ createdAt: 1 });
    if (defaultBranch) {
      const isAdmission = data.source === "admission" || (data.note || "").includes("ভর্তি") || data.feeType === "এককালীন";
      await accountsService.recordAutoIncome({
        date: doc.date,
        category: isMaterialPayment ? "ম্যাটেরিয়াল ফি" : isAdmission ? "ভর্তি ফি" : "কোর্স ফি",
        amount: paidAmount,
        branchId: String(defaultBranch._id),
        method: data.method as never,
        studentId: data.studentId,
        note: `রসিদ: ${receiptNo}${data.month ? ` (${data.month})` : ""}`,
        source: isMaterialPayment ? "material_sale" : isAdmission ? "admission_fee" : "student_fee",
        refId: String(doc._id),
      });
    }
  } catch (err) {
    logger.warn({ err }, "Failed to auto-post payment to accounts ledger");
  }

  return doc;
}

/**
 * Cancels ("delete" in the UI) a wrong/unwanted payment — a soft flag, never
 * a hard delete (Fees/Payment audit §7): the row, its receiptNo and its
 * receipt page stay put for the audit trail, but this reverses exactly what
 * create() did to the student (paid/discount/totalFee/due), removes the
 * one accounting-ledger mirror this payment posted, and excludes it from
 * every default list/aggregate from now on (list()'s `status` filter above,
 * dashboard.service.ts's collection totals).
 */
export async function cancel(req: Request, id: string, reason?: string): Promise<PaymentDoc> {
  const payment = await getById(id);
  if (payment.status === "cancelled") throw ApiError.conflict("Payment is already cancelled");

  const isMaterialPayment = payment.source === "material";
  if (!isMaterialPayment) {
    const student = await Student.findById(payment.studentId);
    if (!student) throw ApiError.notFound("Student not found");

    if (payment.discount > 0) student.discount = Math.max(0, student.discount - payment.discount);
    student.paid = Math.max(0, student.paid - payment.paidAmount);

    const studentService = await import("../students/student.service");
    const fees = studentService.computeFees({
      feeType: student.feeType,
      totalCourseFee: student.totalCourseFee,
      admissionFee: student.admissionFee,
      monthlyFee: student.monthlyFee,
      courseDuration: student.courseDuration,
      discount: student.discount,
      paid: student.paid,
    });
    student.totalFee = fees.totalFee;
    student.due = fees.due;
    await student.save();
  }

  const before = payment.toObject();
  payment.status = "cancelled";
  payment.cancelledAt = new Date();
  payment.cancelledBy = req.user?.id as never;
  if (reason) payment.cancelReason = reason;
  await payment.save();

  // Remove this payment's own auto-posted accounting-ledger entry so
  // Accounts/Branch Ledger totals stay in sync too — targeted at exactly the
  // one entry `recordAutoIncome`'s (source, refId) uniqueness created for
  // THIS payment, never routed through accounts.service.ts's own
  // deleteIncome() (which is deliberately restricted to manually-entered
  // income only — an unrelated safeguard for the Accounts UI's own delete
  // action, not applicable to this internal reversal).
  try {
    const { IncomeEntry } = await import("../accounts/income.model");
    await IncomeEntry.deleteMany({ refId: String(payment._id) });
  } catch (err) {
    logger.warn({ err }, "Failed to remove accounting mirror for cancelled payment");
  }

  await recordAudit({
    req,
    action: "payment.cancel",
    module: "payments",
    targetCollection: "payments",
    targetId: id,
    before,
    after: payment.toObject(),
  });

  return payment;
}
