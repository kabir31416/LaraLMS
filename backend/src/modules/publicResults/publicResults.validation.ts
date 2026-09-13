import { z } from "zod";

const dateStringSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "সঠিক তারিখ নির্বাচন করুন।")
  .refine((v) => !Number.isNaN(new Date(v).getTime()), "সঠিক তারিখ নির্বাচন করুন।");

/**
 * The public individual-result lookup (Phase 6 §7-§9). `roll` is validated
 * loosely here — normalization (Bengali digits, trimming) and the
 * "not found" / "ambiguous" cases happen in the service, same as
 * auth.service.ts's studentLogin does for the same field.
 *
 * The startDate <= endDate business rule is deliberately NOT a zod
 * `.refine()` here: errorHandler.middleware.ts always collapses a ZodError
 * down to the generic top-level message "Invalid input" (the actual
 * per-issue text only reaches `error.fields`, which this app's error UI
 * doesn't read) — so a refine's Bengali message would never actually reach
 * the visitor. publicResults.service.ts throws a plain ApiError for this
 * instead, whose `message` *does* surface as-is (Phase 6 §21).
 */
export const publicIndividualResultQuerySchema = z.object({
  query: z.object({
    roll: z.string().trim().min(1, "সঠিক রোল নম্বর প্রদান করুন।").max(30),
    startDate: dateStringSchema,
    endDate: dateStringSchema,
  }),
});

export const publicBatchListQuerySchema = z.object({
  query: z.object({
    courseId: z.string().length(24).optional(),
  }),
});
