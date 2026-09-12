import { Request } from "express";
import { Payment, PaymentDoc } from "./payment.model";
import { Student } from "../students/student.model";
import { ApiError } from "../../common/utils/ApiError";
import { recordAudit } from "../../audit/auditLog.service";
import { buildMeta, buildSearchFilter, parsePagination } from "../../common/utils/pagination";
import { generateReceiptNumber } from "../../common/utils/idGenerators";

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
  },
): Promise<PaymentDoc> {
  const student = await Student.findById(data.studentId);
  if (!student) throw ApiError.notFound("Student not found");

  const paidAmount = data.amount - data.discount + data.fine;
  if (paidAmount < 0) throw ApiError.badRequest("Discount cannot exceed amount + fine");

  const receiptNo = await generateReceiptNumber();
  const doc = await Payment.create({
    ...data,
    receiptNo,
    date: data.date || new Date().toISOString().slice(0, 10),
    paidAmount,
    batchId: student.currentBatchId,
  });

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

  await recordAudit({ req, action: "payment.create", module: "payments", targetCollection: "payments", targetId: String(doc._id), after: doc.toObject() });
  return doc;
}
