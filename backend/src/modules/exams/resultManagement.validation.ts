import { z } from "zod";

export const studentIdParamSchema = z.object({ params: z.object({ studentId: z.string().length(24) }) });

export const listStudentResultsQuerySchema = z.object({
  query: z.object({
    batchId: z.string().length(24).optional(),
    search: z.string().trim().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

export const topStudentsQuerySchema = z.object({
  query: z.object({
    batchId: z.string().length(24).optional(),
    limit: z.string().optional(),
  }),
});

export const batchResultsQuerySchema = z.object({
  query: z.object({
    batchId: z.string().length(24),
    subjectId: z.string().length(24).optional(),
    lectureId: z.string().length(24).optional(),
    examId: z.string().length(24).optional(),
  }),
});

export const updateResultMarkSchema = z.object({
  params: z.object({ resultId: z.string().length(24) }),
  body: z.object({ marks: z.number().min(0).nullable() }),
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "তারিখ অবশ্যই YYYY-MM-DD ফরম্যাটে হতে হবে");

/** Shared filter shape for the Result Records list, the bulk-delete preview, and the bulk delete itself — kept in one place so all three can never validate the filter differently. */
const resultRecordFilterShape = {
  date: isoDate.optional(),
  dateFrom: isoDate.optional(),
  dateTo: isoDate.optional(),
  courseId: z.string().length(24).optional(),
  batchId: z.string().length(24).optional(),
  subjectId: z.string().length(24).optional(),
  lectureId: z.string().length(24).optional(),
  examId: z.string().length(24).optional(),
  search: z.string().trim().optional(),
  isPublished: z.enum(["true", "false"]).optional(),
};

export const listResultRecordsQuerySchema = z.object({
  query: z.object({ ...resultRecordFilterShape, page: z.string().optional(), limit: z.string().optional() }),
});

export const resultRecordFilterBodySchema = z.object({ body: z.object(resultRecordFilterShape) });

export const resultIdParamSchema = z.object({ params: z.object({ resultId: z.string().length(24) }) });

/** Mode B's "selected rows" delete — a bounded list of exact resultIds (never an unbounded/unvalidated array), each re-validated for permission server-side in the service layer. */
export const deleteSelectedResultsSchema = z.object({
  body: z.object({
    resultIds: z.array(z.string().length(24)).min(1, "অন্তত একটি ফলাফল নির্বাচন করুন").max(500, "একবারে সর্বোচ্চ ৫০০ টি ফলাফল মুছা যাবে"),
  }),
});
