import { z } from "zod";
import { PUBLIC_INFO_ALLOWED_FIELDS } from "./settings.model";

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
