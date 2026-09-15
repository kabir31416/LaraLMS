import { Request } from "express";
import { PaymentMethod, PaymentMethodDoc } from "./paymentMethod.model";
import { ApiError } from "../../common/utils/ApiError";
import { recordAudit } from "../../audit/auditLog.service";
import { buildMeta, buildSearchFilter, parsePagination } from "../../common/utils/pagination";

export async function list(req: Request) {
  const { page, limit, skip, sort } = parsePagination(req, { displayOrder: 1, name: 1 });
  const filter = buildSearchFilter(req.query.search, ["name"]);
  const [items, total] = await Promise.all([
    PaymentMethod.find(filter).sort(sort).skip(skip).limit(limit),
    PaymentMethod.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

export async function create(req: Request, data: Pick<PaymentMethodDoc, "name"> & Partial<Pick<PaymentMethodDoc, "status" | "displayOrder">>) {
  const doc = await PaymentMethod.create(data);
  await recordAudit({ req, action: "payment-method.create", module: "settings", targetCollection: "paymentmethods", targetId: String(doc._id), after: doc.toObject() });
  return doc;
}

export async function update(req: Request, id: string, patch: Partial<Pick<PaymentMethodDoc, "name" | "status" | "displayOrder">>) {
  const doc = await PaymentMethod.findById(id);
  if (!doc) throw ApiError.notFound("Payment method not found");
  const before = doc.toObject();
  Object.assign(doc, patch);
  await doc.save();
  await recordAudit({ req, action: "payment-method.update", module: "settings", targetCollection: "paymentmethods", targetId: id, before, after: doc.toObject() });
  return doc;
}

export async function remove(req: Request, id: string) {
  const doc = await PaymentMethod.findById(id);
  if (!doc) throw ApiError.notFound("Payment method not found");
  const { Payment } = await import("../payments/payment.model");
  if (await Payment.exists({ method: doc.name })) {
    throw ApiError.conflict("This payment method has payments recorded against it — deactivate it instead of deleting");
  }
  await doc.deleteOne();
  await recordAudit({ req, action: "payment-method.delete", module: "settings", targetCollection: "paymentmethods", targetId: id, before: doc.toObject() });
}

/**
 * Used by payment.service.ts and student.service.ts (admission-time
 * payment) instead of the old `z.enum(PAYMENT_METHODS)` — validates against
 * real master data rather than a hard-coded array, while still rejecting an
 * unknown or deactivated name outright (Settings §9/§25 — never silently
 * create a new "method" from free text).
 */
export async function assertActiveMethod(name: string): Promise<void> {
  const exists = await PaymentMethod.exists({ name, status: "সক্রিয়" });
  if (!exists) throw ApiError.badRequest("অবৈধ বা নিষ্ক্রিয় পেমেন্ট মাধ্যম");
}
