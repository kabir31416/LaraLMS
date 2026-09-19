# Document 06 — Known Limitations

Everything partial, not included, or needing live verification, gathered in one place. Nothing here is a secret defect — each item was found by direct source-code audit and is disclosed here deliberately.

## Functional limitations (carried over from Document 02)

| Item | Nature | Detail |
|---|---|---|
| Video Class | Browser-only | Not connected to the backend/database. Data lives in one browser's local storage only — does not sync across devices/users and is lost if site data is cleared. No file upload or non-YouTube video support. |
| Notice targeting (Director / Staff) | Unreachable audience | The data model and filtering logic support "Director" and "Staff" targeted notices, but no current screen displays them to those audiences. Only "Everyone", "Course", and "Batch" targeting are actually visible anywhere today. |
| Result Report course filter | Non-functional control | The on-screen "Course" filter for the Result report does not affect the results shown; Subject and Lecture filters do work. |
| Role Management | No UI | The backend supports arbitrary custom roles/permission sets via its API. No screen exists to create one — only the three built-in roles (Admin, Batch Director, Student) are reachable from the UI. |
| Branch creation screen | Requires Verification | The Branch record and Branch Ledger are fully implemented and used elsewhere, but no dedicated "create/edit a Branch" screen was located in this audit. Confirm with the development team whether branches are seeded directly or managed from a screen this audit didn't locate. |
| Online exam-taking | Not included | Permission keys exist in the access-control catalogue, but no screen lets a student take an exam online. All exams/results are entered offline by staff. |
| Notice attachments | Not included | A notice is text-only; no file-attachment field exists. |
| Deployment automation | Not included | No Docker, CI/CD, or hosting scripts exist in the repository. Deployment today is a manual build-and-run process (see Document 07). |

## Cosmetic-only items (not fixed — out of scope for a production-blocker audit)

- The search box in the Topbar (top of every Admin/Director page) is a visual placeholder — it accepts typing but does not currently filter or search anything.
- The notification bell icon in the Topbar is decorative — it shows a static indicator dot but is not backed by a real notification system.

## Sandbox / audit-process disclosure

This handover package, and the accompanying production-readiness audit, were produced without access to a live MongoDB instance, a Docker environment, or a browser in the development sandbox. Every statement in these documents is either:

- **Verified by code** — read directly from the source and confirmed to say what this document claims, or
- **Verified by automated command output** — `tsc --noEmit`, `eslint`, and `vite build` were actually executed and their output captured, or
- **Marked "Requires Verification"** — explicitly flagged wherever the audit could not confirm behavior without a live database/browser.

Nothing in this package claims a manual click-through or live end-to-end test that was not actually performed. See Document 08 for the specific manual checks recommended before go-live.
