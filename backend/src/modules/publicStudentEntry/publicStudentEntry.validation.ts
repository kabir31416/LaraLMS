import { z } from "zod";
import { RELATIONS } from "../students/student.constants";
import { hscSscEducationFields } from "../students/student.validation";

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
 *
 * The HSC/SSC fields are the literal shared `hscSscEducationFields` object
 * from student.validation.ts, not an independently hand-copied list — this
 * keeps this schema and updateSelfSchema from ever drifting out of sync
 * again (HSC/SSC required-fields + বিভাগ audit §5-§8: every HSC/SSC field is
 * mandatory except GPA, and বিভাগ is a closed 3-value enum). `dob` is
 * included here too (DOB self-edit audit §3) — Student.dob is already a
 * plain optional string field, reused as-is. `guardianOccupation`/
 * `guardianAddress` were removed here too (Guardian পেশা/ঠিকানা audit §9) —
 * StudentEntry.tsx no longer sends them; any previously-saved value stays
 * in the database untouched.
 */
export const updatePublicProfileSchema = z.object({
  body: z
    .object({
      dob: z.string().trim().min(1).optional(),
      presentAddress: z.string().trim().optional(),
      permanentAddress: z.string().trim().optional(),
      division: z.string().trim().optional(),
      district: z.string().trim().optional(),
      upazila: z.string().trim().optional(),
      postOffice: z.string().trim().optional(),
      postcode: z.string().trim().optional(),
      village: z.string().trim().optional(),
      ...hscSscEducationFields,
      guardianName: z.string().trim().optional(),
      guardianRelation: z.enum(RELATIONS).optional(),
    })
    .strict(),
});
