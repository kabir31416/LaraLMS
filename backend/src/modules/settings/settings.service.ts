import { Request } from "express";
import {
  PublicInfoSettings,
  PublicInfoSettingsDoc,
  PublicResultsSettings,
  PublicResultsSettingsDoc,
  Settings,
  SettingsDoc,
} from "./settings.model";
import { getOrCreateSingleton } from "../../common/utils/singleton";
import { recordAudit } from "../../audit/auditLog.service";

export async function getSettings(): Promise<SettingsDoc> {
  return getOrCreateSingleton(Settings, {} as SettingsDoc);
}

export async function updateSettings(req: Request, patch: Partial<SettingsDoc>): Promise<SettingsDoc> {
  const settings = await getSettings();
  const before = settings.toObject();
  Object.assign(settings, patch);
  await settings.save();
  await recordAudit({ req, action: "settings.update", module: "settings", targetCollection: "settings", targetId: String(settings._id), before, after: settings.toObject() });
  return settings;
}

export async function getPublicInfoSettings(): Promise<PublicInfoSettingsDoc> {
  return getOrCreateSingleton(PublicInfoSettings, {} as PublicInfoSettingsDoc);
}

export async function updatePublicInfoSettings(req: Request, patch: Partial<PublicInfoSettingsDoc>): Promise<PublicInfoSettingsDoc> {
  const settings = await getPublicInfoSettings();
  const before = settings.toObject();
  if (patch.searchMethods) settings.searchMethods = { ...settings.searchMethods, ...patch.searchMethods };
  if (patch.rateLimits) settings.rateLimits = { ...settings.rateLimits, ...patch.rateLimits };
  if (patch.visibleFields) settings.visibleFields = patch.visibleFields;
  if (patch.enabled !== undefined) settings.enabled = patch.enabled;
  await settings.save();
  await recordAudit({ req, action: "settings.public-info.update", module: "settings", targetCollection: "publicinfosettings", targetId: String(settings._id), before, after: settings.toObject() });
  return settings;
}

export async function getPublicResultsSettings(): Promise<PublicResultsSettingsDoc> {
  return getOrCreateSingleton(PublicResultsSettings, {} as PublicResultsSettingsDoc);
}

export async function updatePublicResultsSettings(req: Request, patch: Partial<PublicResultsSettingsDoc>): Promise<PublicResultsSettingsDoc> {
  const settings = await getPublicResultsSettings();
  const before = settings.toObject();
  Object.assign(settings, patch);
  await settings.save();
  await recordAudit({
    req,
    action: "settings.public-results.update",
    module: "settings",
    targetCollection: "publicresultssettings",
    targetId: String(settings._id),
    before,
    after: settings.toObject(),
  });
  return settings;
}
