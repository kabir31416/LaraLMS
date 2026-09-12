/** System role names. Extra roles (e.g. "accountant") can be added later without code changes — see modules/rbac. */
export const SYSTEM_ROLES = ["admin", "batch_director", "student"] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

export const ACCOUNT_STATUS = ["active", "locked"] as const;

/** Max failed logins before a User is auto-locked (Phase 2 §13). */
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
