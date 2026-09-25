/**
 * Frontend-side permission key constants — must stay in sync with the
 * backend's own catalog (backend/src/modules/rbac/permissions.ts). Kept
 * minimal on purpose: only the keys some frontend page/nav-item actually
 * needs to check are listed here, not a full mirror of the backend catalog.
 */
export const ADMISSION_RESULTS_MANAGE = "admission-results:manage";
export const STUDENTS_READ = "students:read";
export const STUDENTS_CREATE = "students:create";
export const STUDENTS_UPDATE = "students:update";
export const STUDENTS_DELETE = "students:delete";
export const STUDENTS_MANAGE_ROLL = "students:manage-roll";
export const STUDENTS_APPROVE_ENTRY = "students:approve-entry";
export const PAYMENTS_READ = "payments:read";
export const PAYMENTS_CREATE = "payments:create";
export const PAYMENTS_DELETE = "payments:delete";
export const RECEIPTS_READ = "receipts:read";
export const ATTENDANCE_MARK = "attendance:mark";
export const ATTENDANCE_READ = "attendance:read";
export const EXAMS_MANAGE = "exams:manage";
export const RESULTS_READ = "results:read";
export const VIDEOS_MANAGE = "videos:manage";
export const NOTICES_MANAGE = "notices:manage";
export const REPORTS_READ = "reports:read";
export const STAFF_MANAGE = "staff:manage";
export const BATCHES_MANAGE = "batches:manage";
export const ENROLLMENTS_MANAGE = "enrollments:manage";
export const MATERIALS_VIEW = "materials:view";
export const MATERIALS_CREATE = "materials:create";
export const MATERIALS_UPDATE = "materials:update";
export const MATERIALS_DEACTIVATE = "materials:deactivate";
export const MATERIALS_STOCK_ADD = "materials:stock:add";
export const MATERIALS_STOCK_ADJUST = "materials:stock:adjust";
export const MATERIALS_DISTRIBUTE = "materials:distribute";
export const MATERIALS_DISTRIBUTION_VIEW = "materials:distribution:view";
export const MATERIALS_DISTRIBUTION_REVERSE = "materials:distribution:reverse";
export const MATERIALS_REPORT_VIEW = "materials:report:view";
export const ACCOUNTS_MANAGE = "accounts:manage";
export const BRANCH_LEDGER_MANAGE = "branch-ledger:manage";
export const SETTINGS_MANAGE = "settings:manage";
export const PUBLIC_INFO_MANAGE = "public-info:manage";
export const PUBLIC_RESULTS_MANAGE = "public-results:manage";
export const PAYMENT_METHODS_MANAGE = "payment-methods:manage";
export const SMS_MANAGE = "sms:manage";

export interface SidebarModule {
  /** Stable key — used as the React key and as the StaffForm checkbox id, never shown to the user. */
  key: string;
  label: string;
  permissions: string[];
  /** Admin sidebar route(s) this module gates (AppSidebar.tsx) — more than one when a module toggle covers two nav items sharing the same backend permission(s). */
  urls: string[];
}

/**
 * Every Admin sidebar module that can actually be restricted per-Admin via
 * User.deniedPermissions (auth.service.ts's resolvePermissions — a wildcard
 * "*" role minus this array), in sidebar order. Two pairs are deliberately
 * merged into one toggle each because they share the exact same backing
 * permission key on the backend (denying one would silently deny the
 * other anyway): "শিক্ষার্থী" (Students) + "ভর্তি" (Admission) both need
 * STUDENTS_CREATE for their own "add" action; "এক্সাম" (Exams) +
 * "ফলাফল ব্যবস্থাপনা" (Result Management) both need EXAMS_MANAGE.
 *
 * ড্যাশবোর্ড (Dashboard) is deliberately excluded — it has no backend
 * permission gate at all (requireRole only), and every Admin needs some
 * landing page regardless of what else they're restricted from.
 *
 * "রিপোর্ট" (Reports) has no backend route of its own (it aggregates data
 * from other modules' own permission-gated endpoints) — REPORTS_READ here
 * only controls whether the nav item/page itself is shown, not a real
 * server-side boundary; the data it would show is still separately gated
 * by whatever other module permissions this same Admin does or doesn't have.
 */
export const SIDEBAR_MODULES: SidebarModule[] = [
  { key: "students", label: "শিক্ষার্থী ও ভর্তি", permissions: [STUDENTS_READ, STUDENTS_CREATE, STUDENTS_UPDATE, STUDENTS_DELETE, STUDENTS_MANAGE_ROLL], urls: ["/students", "/admission"] },
  { key: "admission-result", label: "অ্যাডমিশন রেজাল্ট", permissions: [ADMISSION_RESULTS_MANAGE], urls: ["/admission-result"] },
  // PAYMENTS_DELETE (payment cancellation) is deliberately NOT required here —
  // this list is AND-ed (AppSidebar.tsx's every()) to decide whether the whole
  // Fees page shows at all, and a staff member already granted this module
  // before payment cancellation existed would otherwise have the entire page
  // vanish from their sidebar the moment this key is added, since their
  // persisted permission set predates it. The Cancel button itself is
  // separately gated by PAYMENTS_DELETE inline in FeeManagement.tsx.
  { key: "fees", label: "ফি ম্যানেজমেন্ট", permissions: [PAYMENTS_READ, PAYMENTS_CREATE, RECEIPTS_READ], urls: ["/fees"] },
  { key: "attendance", label: "উপস্থিতি", permissions: [ATTENDANCE_MARK, ATTENDANCE_READ], urls: ["/attendance"] },
  { key: "exams", label: "এক্সাম ও ফলাফল ব্যবস্থাপনা", permissions: [EXAMS_MANAGE, RESULTS_READ], urls: ["/exams", "/result-management", "/result-entry"] },
  { key: "videos", label: "ভিডিও ক্লাস", permissions: [VIDEOS_MANAGE], urls: ["/videos"] },
  { key: "notices", label: "নোটিশ", permissions: [NOTICES_MANAGE], urls: ["/notices"] },
  { key: "reports", label: "রিপোর্ট", permissions: [REPORTS_READ], urls: ["/reports"] },
  { key: "staff", label: "স্টাফ", permissions: [STAFF_MANAGE], urls: ["/staff"] },
  { key: "batches", label: "ব্যাচ", permissions: [BATCHES_MANAGE, ENROLLMENTS_MANAGE], urls: ["/batches"] },
  {
    key: "materials",
    label: "ম্যাটেরিয়াল",
    permissions: [
      MATERIALS_VIEW, MATERIALS_CREATE, MATERIALS_UPDATE, MATERIALS_DEACTIVATE,
      MATERIALS_STOCK_ADD, MATERIALS_STOCK_ADJUST, MATERIALS_DISTRIBUTE,
      MATERIALS_DISTRIBUTION_VIEW, MATERIALS_DISTRIBUTION_REVERSE, MATERIALS_REPORT_VIEW,
    ],
    urls: ["/books"],
  },
  { key: "accounts", label: "হিসাব", permissions: [ACCOUNTS_MANAGE, BRANCH_LEDGER_MANAGE], urls: ["/accounts"] },
  { key: "settings", label: "সেটিংস", permissions: [SETTINGS_MANAGE, PUBLIC_INFO_MANAGE, PUBLIC_RESULTS_MANAGE, PAYMENT_METHODS_MANAGE, SMS_MANAGE], urls: ["/settings"] },
];
