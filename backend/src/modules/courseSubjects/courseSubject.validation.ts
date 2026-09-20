import { z } from "zod";
import { MASTER_DATA_STATUS } from "../academicSessions/academicSession.model";

export const courseIdParamSchema = z.object({ params: z.object({ courseId: z.string().length(24) }) });

export const courseSubjectIdParamSchema = z.object({
  params: z.object({ courseId: z.string().length(24), courseSubjectId: z.string().length(24) }),
});

export const assignSubjectSchema = z.object({
  params: z.object({ courseId: z.string().length(24) }),
  body: z.object({
    subjectId: z.string().length(24),
    order: z.number().int().min(0).optional(),
  }),
});

export const updateCourseSubjectSchema = z.object({
  params: z.object({ courseId: z.string().length(24), courseSubjectId: z.string().length(24) }),
  body: z.object({
    order: z.number().int().min(0).optional(),
    status: z.enum(MASTER_DATA_STATUS).optional(),
  }),
});
