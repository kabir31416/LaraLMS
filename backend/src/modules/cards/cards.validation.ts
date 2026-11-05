import { z } from "zod";
import { EXAM_STATUSES, EXAM_TYPES } from "./examSchedule.model";
import { ID_CARD_LAYOUTS, VALIDITY_MODES } from "./cardSettings.model";

const id = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");
const ids = z.array(id).min(1).max(1000);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "তারিখ yyyy-mm-dd হতে হবে");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "সময় HH:mm হতে হবে");
const optId = id.nullable().optional().or(z.literal("").transform(() => null));
const optTime = time.nullable().optional().or(z.literal("").transform(() => null));
const optText = (max: number) => z.string().trim().max(max).nullable().optional();
const page = { page: z.string().regex(/^\d+$/).optional(), limit: z.string().regex(/^\d+$/).optional() };

export const idParamSchema = z.object({ params: z.object({ id }) });
export const codeParamSchema = z.object({ params: z.object({ code: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/) }) });
export const examIdParamSchema = z.object({ params: z.object({ examId: id }) });

// ---- ID cards
const cardSelector = z
  .object({ studentIds: ids.optional(), batchId: id.optional(), courseId: id.optional(), all: z.boolean().optional() })
  .refine((s) => !!(s.studentIds?.length || s.batchId || s.courseId || s.all), { message: "শিক্ষার্থী, ব্যাচ, কোর্স বা সবাই নির্বাচন করুন" });

export const idCardListSchema = z.object({
  query: z.object({ ...page, search: z.string().max(100).optional(), courseId: id.optional(), batchId: id.optional(), cardStatus: z.enum(["issued", "not_issued", "outdated"]).optional() }),
});
export const idCardDataSchema = z.object({ body: cardSelector });
export const idCardGenerateSchema = z.object({ body: z.object({ selector: cardSelector, mode: z.enum(["missing", "changed", "all"]).default("changed") }) });

export const cardSettingsSchema = z.object({
  body: z
    .object({
      primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      idCardLayout: z.enum(ID_CARD_LAYOUTS),
      idCardShowBack: z.boolean(),
      validityMode: z.enum(VALIDITY_MODES),
      validUntil: date.optional().or(z.literal("")),
      idCardRules: z.string().max(1000),
      idCardShowEmergencyContact: z.boolean(),
      idCardShowQr: z.boolean(),
      admitShowQr: z.boolean(),
      admitDefaultInstructions: z.string().max(2000),
      admitCardsPerPage: z.union([z.literal(1), z.literal(2)]),
    })
    .partial()
    .refine((b) => b.validityMode !== "date" || !!b.validUntil, { message: "মেয়াদের তারিখ দিন", path: ["validUntil"] }),
});

// ---- scheduled exams
const examBody = z.object({
  name: z.string().trim().min(2, "পরীক্ষার নাম লিখুন").max(150),
  examType: z.enum(EXAM_TYPES),
  courseId: id,
  batchId: optId,
  allowCrossBatch: z.boolean().optional(),
  sessionId: optId,
  subjectId: optId,
  date,
  startTime: optTime,
  endTime: optTime,
  durationMinutes: z.number().int().min(1).max(1440).nullable().optional(),
  venue: optText(200),
  instructions: optText(3000),
  status: z.enum(["draft", "published"]).optional(),
});

export const createExamSchema = z.object({ body: examBody });
export const updateExamSchema = z.object({ params: z.object({ id }), body: examBody.omit({ status: true }).partial() });
export const examStatusSchema = z.object({ params: z.object({ id }), body: z.object({ status: z.enum(EXAM_STATUSES), reason: z.string().trim().max(500).optional() }) });

export const listExamsSchema = z.object({
  query: z.object({
    ...page,
    search: z.string().max(100).optional(),
    courseId: id.optional(),
    batchId: id.optional(),
    examType: z.enum(EXAM_TYPES).optional(),
    status: z.enum(EXAM_STATUSES).optional(),
    when: z.enum(["upcoming", "past"]).optional(),
    dateFrom: date.optional(),
    dateTo: date.optional(),
  }),
});

export const eligibleSchema = z.object({ params: z.object({ id }), query: z.object({ batchId: id.optional(), search: z.string().max(100).optional() }) });
export const assignSchema = z.object({ params: z.object({ id }), body: z.object({ studentIds: ids, method: z.enum(["batch", "student"]) }) });
export const unassignSchema = z.object({ params: z.object({ id }), body: z.object({ studentIds: ids, reason: z.string().trim().max(300).optional() }) });
export const assignmentsSchema = z.object({
  params: z.object({ id }),
  query: z.object({ ...page, batchId: id.optional(), search: z.string().max(100).optional(), admit: z.enum(["generated", "pending", "outdated"]).optional(), status: z.enum(["active", "removed"]).optional() }),
});

const admitSelector = z
  .object({ scope: z.enum(["all", "batch", "students"]), batchId: id.optional(), studentIds: ids.optional() })
  .refine((s) => s.scope !== "batch" || !!s.batchId, { message: "ব্যাচ নির্বাচন করুন", path: ["batchId"] })
  .refine((s) => s.scope !== "students" || !!s.studentIds?.length, { message: "শিক্ষার্থী নির্বাচন করুন", path: ["studentIds"] });

export const generateAdmitsSchema = z.object({ params: z.object({ id }), body: z.object({ selector: admitSelector, mode: z.enum(["missing", "changed", "all"]).default("changed") }) });
export const admitDataSchema = z.object({ params: z.object({ id }), body: z.object({ selector: admitSelector, includePending: z.boolean().optional() }) });
