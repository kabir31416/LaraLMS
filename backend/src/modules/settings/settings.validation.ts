import { z } from "zod";
import { PUBLIC_INFO_ALLOWED_FIELDS, PUBLIC_RESULTS_ALLOWED_FIELDS } from "./settings.model";

export const updateSettingsSchema = z.object({
  body: z
    .object({
      defaultSessionId: z.string().length(24).optional(),
      defaultExamDuration: z.number().int().positive().optional(),
      passingPercentage: z.number().min(0).max(100).optional(),
      shuffleQuestions: z.boolean().optional(),
      publishResults: z.boolean().optional(),
      gradeScale: z.array(z.object({ minPercent: z.number().min(0).max(100), grade: z.string().min(1) })).optional(),
      rollNumberScope: z.enum(["batch", "course", "global"]).optional(),
      admissionFeeBdt: z.number().min(0).optional(),
    })
    .strict(),
});

export const updatePublicInfoSettingsSchema = z.object({
  body: z
    .object({
      enabled: z.boolean().optional(),
      searchMethods: z
        .object({ registrationId: z.boolean().optional(), phone: z.boolean().optional(), name: z.boolean().optional() })
        .optional(),
      visibleFields: z.array(z.enum(PUBLIC_INFO_ALLOWED_FIELDS)).optional(),
      rateLimits: z
        .object({
          exactMatchPerMin: z.number().int().positive().optional(),
          nameSearchPerMin: z.number().int().positive().optional(),
          captchaAfter: z.number().int().positive().optional(),
        })
        .optional(),
    })
    .strict(),
});

export const updatePublicResultsSettingsSchema = z.object({
  body: z
    .object({
      enabled: z.boolean().optional(),
      individualEnabled: z.boolean().optional(),
      batchEnabled: z.boolean().optional(),
      requirePublished: z.boolean().optional(),
      visibleFields: z.array(z.enum(PUBLIC_RESULTS_ALLOWED_FIELDS)).optional(),
    })
    .strict(),
});

const receiptSchema = z.object({
  prefix: z.string().trim().min(1).max(12).optional(),
  numberPadding: z.number().int().min(1).max(10).optional(),
  resetYearly: z.boolean().optional(),
});

const printSchema = z.object({
  footerText: z.string().trim().max(300).optional(),
  signatureLabel: z.string().trim().max(60).optional(),
  paperSize: z.enum(["A4", "Letter"]).optional(),
  showLogoOnDocuments: z.boolean().optional(),
});

export const updateInstitutionSettingsSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(1).max(150).optional(),
      shortName: z.string().trim().max(50).optional(),
      logoUrl: z.string().trim().max(500).optional(),
      address: z.string().trim().max(300).optional(),
      phone: z.string().trim().max(30).optional(),
      email: z.string().trim().email().optional().or(z.literal("")),
      website: z.string().trim().max(200).optional(),
      facebookUrl: z.string().trim().max(200).optional(),
      currencySymbol: z.string().trim().min(1).max(10).optional(),
      dateFormat: z.string().trim().min(1).max(20).optional(),
      timezone: z.string().trim().min(1).max(60).optional(),
      registrationInfo: z.string().trim().max(300).optional(),
      defaultBranchId: z.string().length(24).optional(),
      receipt: receiptSchema.optional(),
      print: printSchema.optional(),
    })
    .strict(),
});
