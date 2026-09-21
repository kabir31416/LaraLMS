import { z } from "zod";
import { SMS_PROVIDERS, SMS_TEMPLATED_EVENTS } from "./sms.constants";

export const updateProviderSchema = z.object({
  body: z.object({ activeProvider: z.enum(SMS_PROVIDERS) }),
});

/**
 * `apiKey` is optional — omitted/blank means "keep the currently saved key"
 * (Admin SMS Settings §3: "Allow admin to update the API key", implying
 * senderId/contentId can be changed without re-typing it every time — the
 * full key is never sent back to the frontend to re-submit in the first
 * place). Sender ID / Content ID stay optional per the provider docs.
 */
export const updateAlphaSettingsSchema = z.object({
  body: z.object({
    apiKey: z.string().trim().max(200).optional(),
    senderId: z.string().trim().max(20).optional().or(z.literal("")),
    contentId: z.string().trim().max(50).optional().or(z.literal("")),
  }),
});

export const updateEventsSchema = z.object({
  body: z.object({
    admission: z.boolean().optional(),
    payment: z.boolean().optional(),
    birthday: z.boolean().optional(),
    result: z.boolean().optional(),
  }),
});

export const updateTemplateSchema = z.object({
  params: z.object({ event: z.enum(SMS_TEMPLATED_EVENTS) }),
  body: z.object({ template: z.string().trim().min(1).max(2000) }),
});

export const testSmsSchema = z.object({
  body: z.object({
    to: z.string().trim().min(6, "সঠিক মোবাইল নম্বর দিন").max(20),
    message: z.string().trim().min(1, "মেসেজ লিখুন").max(500),
  }),
});

export const reportParamSchema = z.object({
  params: z.object({ requestId: z.string().trim().min(1) }),
});

export const listLogsQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    eventType: z.string().optional(),
    status: z.enum(["sent", "failed", "disabled"]).optional(),
    studentId: z.string().optional(),
  }),
});
