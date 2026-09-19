import { z } from "zod";
import { RELATIONS } from "../students/student.constants";

/**
 * "Registration Number / Roll" accepts either identifier, matched together
 * with phone against the *same* student record (publicStudentEntry.service.ts) —
 * loose string bounds here, real validation/normalization happens in the
 * service, same division of labor as auth.validation.ts's studentLoginSchema.
 */
export const verifyStudentEntrySchema = z.object({
  body: z.object({
    identifier: z.string().trim().min(1, "রেজিস্ট্রেশন নম্বর বা রোল দিন").max(50),
    phone: z.string().trim().min(6, "সঠিক মোবাইল নম্বর দিন").max(20),
  }),
});

/**
 * The exact same student-editable subset as student.validation.ts's
 * updateSelfSchema, minus `photoUrl` — Student Photo Management gives photo
 * its own dedicated upload endpoint here, never a plain-string field a
 * public caller could point at an arbitrary URL (Public Security §14/§15).
 * Every field a public visitor is NOT allowed to touch (registrationId,
 * course, batch, fees, status, results, attendance, etc.) is simply absent
 * from this schema — `.strict()` rejects anything else outright rather than
 * silently ignoring it.
 */
export const updatePublicProfileSchema = z.object({
  body: z
    .object({
      presentAddress: z.string().trim().optional(),
      permanentAddress: z.string().trim().optional(),
      division: z.string().trim().optional(),
      district: z.string().trim().optional(),
      upazila: z.string().trim().optional(),
      postOffice: z.string().trim().optional(),
      postcode: z.string().trim().optional(),
      village: z.string().trim().optional(),
      hscInstitution: z.string().trim().optional(),
      hscBoard: z.string().trim().optional(),
      hscPassingYear: z.string().trim().optional(),
      hscGroup: z.string().trim().optional(),
      hscGpa: z.string().trim().optional(),
      hscRoll: z.string().trim().optional(),
      hscRegistrationNumber: z.string().trim().optional(),
      sscInstitution: z.string().trim().optional(),
      sscBoard: z.string().trim().optional(),
      sscPassingYear: z.string().trim().optional(),
      sscGroup: z.string().trim().optional(),
      sscGpa: z.string().trim().optional(),
      sscRoll: z.string().trim().optional(),
      sscRegistrationNumber: z.string().trim().optional(),
      guardianName: z.string().trim().optional(),
      guardianRelation: z.enum(RELATIONS).optional(),
      guardianOccupation: z.string().trim().optional(),
      guardianAddress: z.string().trim().optional(),
    })
    .strict(),
});
