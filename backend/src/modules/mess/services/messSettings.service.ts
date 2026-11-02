import { Request } from "express";
import { getOrCreateSingleton } from "../../../common/utils/singleton";
import { recordAudit } from "../../../audit/auditLog.service";
import { ApiError } from "../../../common/utils/ApiError";
import { MessSettings, MessSettingsDoc } from "../models/messSettings.model";
import { Mess } from "../models/mess.model";

export async function getMessSettings(): Promise<MessSettingsDoc> {
  return getOrCreateSingleton(MessSettings, {} as MessSettingsDoc);
}

export async function updateMessSettings(req: Request, patch: Partial<MessSettingsDoc>): Promise<MessSettingsDoc> {
  const settings = await getMessSettings();
  if (patch.defaultMessId && !(await Mess.exists({ _id: patch.defaultMessId }))) {
    throw ApiError.badRequest("Default Mess not found");
  }
  if (patch.paymentMethods?.length) {
    const { PaymentMethod } = await import("../../paymentMethods/paymentMethod.model");
    const known = await PaymentMethod.find({ name: { $in: patch.paymentMethods } }).distinct("name");
    const unknown = patch.paymentMethods.filter((m) => !known.includes(m));
    if (unknown.length) throw ApiError.badRequest(`Unknown payment method: ${unknown.join(", ")}`);
  }
  const before = settings.toObject();
  Object.assign(settings, patch);
  await settings.save();
  await recordAudit({
    req,
    action: "mess.settings.update",
    module: "mess",
    targetCollection: "messsettings",
    targetId: String(settings._id),
    before,
    after: settings.toObject(),
  });
  return settings;
}

/**
 * Validates a Mess payment/expense/refund method against the shared
 * PaymentMethod master data (paymentMethod.service.ts's assertActiveMethod —
 * reused, never a second payment-method list) and, if the admin limited Mess
 * methods in Mess Settings, against that subset too.
 */
export async function assertMessPaymentMethod(method: string): Promise<void> {
  const paymentMethodService = await import("../../paymentMethods/paymentMethod.service");
  await paymentMethodService.assertActiveMethod(method);
  const settings = await getMessSettings();
  if (settings.paymentMethods.length && !settings.paymentMethods.includes(method)) {
    throw ApiError.badRequest(`"${method}" মেসের পেমেন্ট পদ্ধতি হিসেবে চালু নেই (মেস সেটিংস দেখুন)`);
  }
}
