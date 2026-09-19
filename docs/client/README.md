# LaraLMS — Client Handover Package

**Coaching Management & Learning Management ERP**

| | |
|---|---|
| Document version | 1.1 — verified against the current codebase (updated after the production-readiness audit) |
| Basis | Direct source-code audit, not planning documents |
| Prepared for | Project handover |

## How to read this package

Every feature described in these documents was verified directly in the LaraLMS source code (frontend, backend, and database models) at the time of writing. Where something was planned but is not built, it is marked **Not Included**. Where something works but with a gap, it is marked **Partially Implemented**. Where the audit could not fully confirm behavior without live testing against a running production database/browser, it is marked **Requires Verification**.

## Contents

1. [System Overview](01-system-overview.md) — what LaraLMS is, who it's for, architecture, authentication.
2. [Scope of Delivery](02-scope-of-delivery.md) — what was built, module by module, verified against the running code.
3. [User Manual](03-user-manual.md) — step-by-step guidance for each implemented module.
4. [Roles & Permissions](04-roles-and-permissions.md) — the access-control model, verified from code.
5. [Business Workflows](05-business-workflows.md) — the same processes as the User Manual, as flow diagrams.
6. [Known Limitations](06-known-limitations.md) — everything partial, not included, or needing verification, in one place.
7. [Technical Handover](07-technical-handover.md) — architecture, environment variables, build/deploy notes for whoever operates this system next.
8. [Client Handover Checklist](08-client-handover-checklist.md) — the concrete steps to complete before go-live.

## Changelog

- **v1.1** — Added: self-service **Change Password** (Topbar user menu) and a forced password-change screen shown when the backend flags an account as `mustChangePassword` (previously this flag existed but nothing in the app acted on it — the default seeded Super Admin password could not be rotated through the UI). See §3.5 and §8.
- **v1.0** — Initial handover package.
