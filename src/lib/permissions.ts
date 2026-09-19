/**
 * Frontend-side permission key constants — must stay in sync with the
 * backend's own catalog (backend/src/modules/rbac/permissions.ts). Kept
 * minimal on purpose: only the keys some frontend page/nav-item actually
 * needs to check are listed here, not a full mirror of the backend catalog.
 */
export const ADMISSION_RESULTS_MANAGE = "admission-results:manage";
