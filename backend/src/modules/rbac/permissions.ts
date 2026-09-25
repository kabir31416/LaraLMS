/**
 * Central permission-key catalog — "module:action" convention (Phase 2 §14).
 * Every module's routes reference keys from here via requirePermission(...).
 * Admin gets "*" (wildcard) rather than an enumerated list, so this catalog
 * only needs to be kept accurate for batch_director / student and any future role.
 */
export const PERMISSIONS = {
  // Users & RBAC
  USERS_MANAGE: "users:manage",
  ROLES_MANAGE: "roles:manage",

  // Academic master data
  SETTINGS_MANAGE: "settings:manage",
  SESSIONS_MANAGE: "sessions:manage",
  COURSES_MANAGE: "courses:manage",
  SUBJECTS_MANAGE: "subjects:manage",
  LECTURES_MANAGE: "lectures:manage",

  // Students & admission
  STUDENTS_CREATE: "students:create",
  STUDENTS_READ: "students:read",
  STUDENTS_READ_OWN_BATCH: "students:read:own-batch",
  STUDENTS_UPDATE: "students:update",
  STUDENTS_UPDATE_SELF: "students:update:self",
  STUDENTS_DELETE: "students:delete",
  STUDENTS_MANAGE_ROLL: "students:manage-roll",
  STUDENTS_MANAGE_ADMISSION_ROLL_OWN_BATCH: "students:manage-admission-roll:own-batch",
  /** Student Entry Workflow — approve/reject a pending /newstudententry (or student-completed) application. Separate from STUDENTS_UPDATE so it can be granted/denied independently. */
  STUDENTS_APPROVE_ENTRY: "students:approve-entry",

  // Batches & enrollment
  BATCHES_MANAGE: "batches:manage",
  BATCHES_READ_OWN: "batches:read:own",
  ENROLLMENTS_MANAGE: "enrollments:manage",
  ENROLLMENTS_READ_OWN: "enrollments:read:own",

  // Staff
  STAFF_MANAGE: "staff:manage",

  // Fees / payments / receipts / accounts
  PAYMENTS_CREATE: "payments:create",
  PAYMENTS_READ: "payments:read",
  PAYMENTS_READ_OWN: "payments:read:own",
  PAYMENTS_DELETE: "payments:delete",
  RECEIPTS_READ: "receipts:read",
  ACCOUNTS_MANAGE: "accounts:manage",
  BRANCH_LEDGER_MANAGE: "branch-ledger:manage",

  // Attendance
  ATTENDANCE_MARK: "attendance:mark",
  ATTENDANCE_MARK_OWN_BATCH: "attendance:mark:own-batch",
  ATTENDANCE_READ: "attendance:read",
  ATTENDANCE_READ_OWN: "attendance:read:own",

  // Exams & results
  EXAMS_MANAGE: "exams:manage",
  EXAMS_READ_OWN_BATCH: "exams:read:own-batch",
  EXAM_ATTEMPTS_SUBMIT: "exam-attempts:submit",
  EXAM_ATTEMPTS_READ_OWN: "exam-attempts:read:own",
  OFFLINE_RESULTS_MANAGE_OWN_BATCH: "offline-results:manage:own-batch",
  RESULTS_READ: "results:read",
  RESULTS_READ_OWN: "results:read:own",

  // Video classes / routine / notices
  VIDEOS_MANAGE: "videos:manage",
  VIDEOS_READ: "videos:read",
  ROUTINE_MANAGE: "routine:manage",
  NOTICES_MANAGE: "notices:manage",
  NOTICES_READ: "notices:read",

  // Coaching Material Inventory & Student Distribution
  MATERIALS_VIEW: "materials:view",
  MATERIALS_CREATE: "materials:create",
  MATERIALS_UPDATE: "materials:update",
  MATERIALS_DEACTIVATE: "materials:deactivate",
  MATERIALS_STOCK_ADD: "materials:stock:add",
  MATERIALS_STOCK_ADJUST: "materials:stock:adjust",
  MATERIALS_DISTRIBUTE: "materials:distribute",
  MATERIALS_DISTRIBUTION_VIEW: "materials:distribution:view",
  MATERIALS_DISTRIBUTION_REVERSE: "materials:distribution:reverse",
  MATERIALS_REPORT_VIEW: "materials:report:view",
  MATERIALS_READ_OWN: "materials:read:own",
  MATERIAL_TYPES_MANAGE: "material-types:manage",

  // Branches
  BRANCHES_MANAGE: "branches:manage",

  // Reports & public info settings
  REPORTS_READ: "reports:read",
  PUBLIC_INFO_MANAGE: "public-info:manage",
  PUBLIC_RESULTS_MANAGE: "public-results:manage",
  /** SMS Provider Upgrade §18 — provider config, event toggles, templates, test SMS and history are all Admin/Super Admin only (Admin already holds this via the "*" wildcard). */
  SMS_MANAGE: "sms:manage",

  // Settings-adjacent master data & platform controls
  PAYMENT_METHODS_MANAGE: "payment-methods:manage",
  AUDIT_READ: "audit:read",

  // Admission Result matching (PDF import, Chance Students, institute/batch analysis)
  ADMISSION_RESULTS_MANAGE: "admission-results:manage",
  ADMISSION_RESULTS_READ_OWN_BATCH: "admission-results:read:own-batch",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSION_KEYS: string[] = Object.values(PERMISSIONS);

/** Seeded on first run (scripts/seed.ts) — matches the Phase 1 §8/§19 role matrix. */
export const DEFAULT_ROLE_PERMISSIONS: Record<"admin" | "batch_director" | "student", string[]> = {
  admin: ["*"],
  batch_director: [
    PERMISSIONS.STUDENTS_READ_OWN_BATCH,
    PERMISSIONS.STUDENTS_MANAGE_ADMISSION_ROLL_OWN_BATCH,
    PERMISSIONS.ADMISSION_RESULTS_READ_OWN_BATCH,
    PERMISSIONS.BATCHES_READ_OWN,
    PERMISSIONS.ENROLLMENTS_READ_OWN,
    PERMISSIONS.ATTENDANCE_MARK_OWN_BATCH,
    PERMISSIONS.ATTENDANCE_READ,
    PERMISSIONS.EXAMS_READ_OWN_BATCH,
    PERMISSIONS.OFFLINE_RESULTS_MANAGE_OWN_BATCH,
    PERMISSIONS.RESULTS_READ,
    PERMISSIONS.VIDEOS_READ,
    PERMISSIONS.NOTICES_READ,
  ],
  student: [
    PERMISSIONS.STUDENTS_UPDATE_SELF,
    PERMISSIONS.PAYMENTS_READ_OWN,
    PERMISSIONS.ATTENDANCE_READ_OWN,
    PERMISSIONS.EXAM_ATTEMPTS_SUBMIT,
    PERMISSIONS.EXAM_ATTEMPTS_READ_OWN,
    PERMISSIONS.RESULTS_READ_OWN,
    PERMISSIONS.VIDEOS_READ,
    PERMISSIONS.NOTICES_READ,
    PERMISSIONS.MATERIALS_READ_OWN,
  ],
};
