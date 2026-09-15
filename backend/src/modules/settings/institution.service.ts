import { Request } from "express";
import { InstitutionSettings, InstitutionSettingsDoc, PUBLIC_INSTITUTION_FIELDS } from "./institution.model";
import { getOrCreateSingleton } from "../../common/utils/singleton";
import { recordAudit } from "../../audit/auditLog.service";

export async function getInstitutionSettings(): Promise<InstitutionSettingsDoc> {
  return getOrCreateSingleton(InstitutionSettings, {} as InstitutionSettingsDoc);
}

export async function updateInstitutionSettings(req: Request, patch: Partial<InstitutionSettingsDoc>): Promise<InstitutionSettingsDoc> {
  const settings = await getInstitutionSettings();
  const before = settings.toObject();
  if (patch.receipt) settings.receipt = { ...settings.receipt, ...patch.receipt };
  if (patch.print) settings.print = { ...settings.print, ...patch.print };
  const { receipt: _receipt, print: _print, ...rest } = patch;
  Object.assign(settings, rest);
  await settings.save();
  await recordAudit({
    req,
    action: "settings.institution.update",
    module: "settings",
    targetCollection: "institutionsettings",
    targetId: String(settings._id),
    before,
    after: settings.toObject(),
  });
  return settings;
}

/** No-login subset for /public/institution — never email/registrationInfo/receipt/print internals (Settings §18). */
export async function getPublicInstitutionInfo(): Promise<Record<string, unknown>> {
  const settings = await getInstitutionSettings();
  const obj = settings.toObject();
  const out: Record<string, unknown> = {};
  for (const field of PUBLIC_INSTITUTION_FIELDS) out[field] = obj[field as keyof typeof obj] ?? null;
  return out;
}
