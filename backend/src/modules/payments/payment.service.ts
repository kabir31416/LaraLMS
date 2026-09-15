import { Request } from "express";
import { Payment, PaymentDoc } from "./payment.model";
import { Student } from "../students/student.model";
import { Branch } from "../branches/branch.model";
import * as accountsService from "../accounts/accounts.service";
import { ApiError } from "../../common/utils/ApiError";
import { recordAudit } from "../../audit/auditLog.service";
import { buildMeta, buildSearchFilter, parsePagination } from "../../common/utils/pagination";
import { generateReceiptNumber } from "../../common/utils/idGenerators";
import { logger } from "../../logger/logger";

export async function list(req: Request) {
  const { page, limit, skip, sort } = parsePagination(req, { date: -1, createdAt: -1 });
  const filter: Record<string, unknown> = { ...buildSearchFilter(req.query.search, ["receiptNo"]) };
  if (req.query.studentId) filter.studentId = req.query.studentId;
  if (req.query.feeType) filter.feeType = req.query.feeType;
  if (req.query.method) filter.method = req.query.method;
  if (req.query.dateFrom || req.query.dateTo) {
    filter.date = {
      ...(req.query.dateFrom ? { $gte: req.query.dateFrom } : {}),
      ...(req.query.dateTo ? { $lte: req.query.dateTo } : {}),
    };
  }

  const [items, total] = await Promise.all([
    Payment.find(filter).sort(sort).skip(skip).limit(limit),
    Payment.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

export async function getById(id: string): Promise<PaymentDoc> {
  const doc = await Payment.findById(id);
  if (!doc) throw ApiError.notFound("Payment not found");
  return doc;
}

/**
 * A payment is a financial event, not an editable record — Phase 1 §6's fee
 * module review — so there is deliberately no update/delete here, only
 * create + read. A correction is its own new payment (e.g. a negative
 * adjustment via discount), which keeps the receipt trail intact.
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
  },
): Promise<PaymentDoc> {
  const student = await Student.findById(data.studentId);
  if (!student) throw ApiError.notFound("Student not found");

  const paymentMethodService = await import("../paymentMethods/paymentMethod.service");
  await paymentMethodService.assertActiveMethod(data.method);

  const paidAmount = data.amount - data.discount + data.fine;
  if (paidAmount < 0) throw ApiError.badRequest("Discount cannot exceed amount + fine");

  const previousDue = student.due;
  const receiptNo = await generateReceiptNumber();
  const doc = await Payment.create({
    ...data,
    receiptNo,
    date: data.date || new Date().toISOString().slice(0, 10),
    paidAmount,
    batchId: student.currentBatchId,
    courseId: student.courseId,
    previousDue,
    createdBy: req.user?.id,
  });

  // A material payment is a real fee-collection event but is NOT part of
  // tuition — the Coaching Material Inventory module (§6) reuses this
  // function purely to get a real receipt + Payment-history row, and must
  // never move the student's tuition due/paid/totalFee balance.
  const isMaterialPayment = data.source === "material";
  if (!isMaterialPayment) {
    // Same due formula as student.service.ts's computeFees — kept local here
    // rather than importing it, matching the enrollment module's convention of
    // mutating Student directly instead of routing through another module's
    // private helpers.
    student.paid += paidAmount;
    const isOneTime = student.feeType === "এককালীন";
    const totalFee = isOneTime
      ? student.totalCourseFee + student.admissionFee - student.discount
      : student.admissionFee + student.monthlyFee * student.courseDuration - student.discount;
    student.totalFee = totalFee;
    student.due = totalFee - student.paid;
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
