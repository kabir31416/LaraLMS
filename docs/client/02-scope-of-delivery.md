# Document 02 — Scope of Delivery

Exactly what was built, verified module by module against the running code — not the original plan.

**Legend:** ✅ Delivered — fully working, verified in code · 🟡 Partial — works, with a named gap · ⛔ Not Included — not present / not functional · 🔵 Verify — needs a live check

## 2.1 Delivered Modules

| Module | Status | Included Features |
|---|---|---|
| Dashboard | ✅ Delivered | Role-specific summary (Admin / Batch Director) with stat cards, recent admissions, low-attendance flags, top performers. |
| Admission | ✅ Delivered | Single-student admission form; auto Registration ID; course-fee & admission-fee snapshot; discount; optional first payment; guardian & HSC/SSC fields. |
| Bulk Excel Admission | ✅ Delivered | Template download, upload, per-row validation, preview, row-by-row approve/reject, import history. |
| Student Management | ✅ Delivered | Server-side filtered/paginated list, print & Excel export, roll-number-ascending sort by default. |
| Student Profile | ✅ Delivered | Full profile, guardian info, payment history, batch info, profile-completion tracker, Admission Result tab. |
| Academic Setup (Session/Course/Subject/Lecture) | ✅ Delivered | Full CRUD hierarchy; Course fee is the single source for admission fee calculation. |
| Batch Management | ✅ Delivered | Create/edit batch, assign Director, add/remove/transfer students, roster view. |
| Staff Management | ✅ Delivered | Staff CRUD; Admin-type staff get a real password login; Super-Admin-only edit/delete for Admin-type staff; per-module permission picker at creation/edit. |
| Batch Director Portal | ✅ Delivered | Own dashboard, own students, combined attendance+result entry, result management, own-batch Admission Result. |
| Fees Management | ✅ Delivered | Due list, add-payment dialog with duplicate-click protection, payment history, configurable payment methods. |
| Payment Receipt | ✅ Delivered | Dedicated print-ready receipt, configurable numbering format, institution branding. |
| Admission Result | ✅ Delivered | PDF import, matching against the coaching's own admission roll, per-Admin toggle-able access. |
| Result Entry (Batch Director) | ✅ Delivered | Save Result vs. Send Result (SMS) as separate actions; configurable SMS template; per-student retry. |
| Result Management | ✅ Delivered | All-students summary, top performers, batch result matrix. |
| Exam Management | ✅ Delivered | Offline exam records with subject/lecture/date/full marks and grading against the configured grade scale. |
| Attendance | ✅ Delivered | Admin dashboard (today/week/month %), daily breakdown, top-10; entered by the Batch Director together with results. |
| Material Management | ✅ Delivered | Material types, stock, distribution (free or paid), paid distribution creates a real payment, distribution history. |
| Reports | ✅ Delivered | 8 report types, each printable and exportable to Excel/PDF (see the one known limitation in Document 06). |
| Notice Management (Admin authoring) | ✅ Delivered | Create/edit/pin/expire notices targeted at All / Course / Batch. |
| Public Student Information | ✅ Delivered | No-login lookup by Registration ID, phone, or name; Admin controls which fields are visible; rate-limited. |
| Public Marksheet | ✅ Delivered | No-login individual result lookup and batch master sheet; togglable, rate-limited. |
| Student Portal | ✅ Delivered | Dashboard, profile (with self-editable section), attendance, results, payments, material history, notices. |
| Settings | ✅ Delivered | Institution, Academic, Student, Result, Finance, Material, Public, Audit Log sections — see the User Manual's Settings section for the full field list. |
| Authentication / Security | ✅ Delivered | bcrypt password hashing, JWT access/refresh separation, rate limiting, audit logging, duplicate-payment protection, enforced forced-password-change flow with self-service Change Password (added in v1.1). |

## 2.2 Partially Delivered

| Module | Status | What Works | What Doesn't |
|---|---|---|---|
| Video Class | 🟡 Partial | An Admin can add a title + YouTube link against a Lecture; Students can browse and click through by subject. | This is a **browser-only** feature — it is not connected to the backend/database at all. Data is stored in that one browser's local storage, does not sync between devices or users, and disappears if the browser's site data is cleared. No file upload or non-YouTube video support exists. |
| Notice Management (targeting) | 🟡 Partial | Admin can create a notice targeted at "Director" or "Staff" audiences; the underlying filtering logic exists. | No Batch Director-facing page currently displays Director-targeted notices, and Staff-targeted notices are not shown to anyone in the current frontend — both sit in the database but are effectively unreachable by their intended audience today. |
| Result Report (Reports module) | 🟡 Partial | Subject and Lecture filters work correctly. | The report's "Course" filter control is present on screen but not wired to anything — selecting a course does not change the results shown. |
| User/Role Management | 🟡 Partial | The backend fully supports creating custom roles with custom permission sets via its API. | No screen in the application exposes this — end users only ever see the three built-in roles (Admin, Batch Director, Student). Creating a genuinely new role today would require direct API access, not a UI. |
| Branch Management | 🔵 Requires Verification | The Branch record and Branch Ledger (money/material sent to and received from a branch) are fully implemented and used across Accounts and Reports. | No dedicated "create/edit a Branch" screen was located in this audit — branches may be seeded directly or managed from a screen this audit didn't identify. **Recommend a short live walkthrough with the development team to confirm.** |

## 2.3 Not Included / Not Currently Implemented

- **Real video hosting/upload** — see Video Class above; only a local-browser YouTube-link stub exists.
- **Online exam-taking (student self-attempt) interface** — permission keys for it exist in the access-control catalogue, but no screen was found that lets a student actually take an exam online; all exam/result entry in the current system is offline, entered by staff.
- **Notice file attachments** — a notice is text-only (title, description, priority, dates); no attachment field exists.
- **Role Management screen** — see Partially Delivered above.
- **Deployment automation** (Docker, CI/CD pipeline, hosting scripts) — none exists in the repository; deployment is a manual build-and-run process today.

## 2.4 Future Development (Suggested, Not Committed)

The following were identified as natural next steps based on scaffolding already present in the code, but are **not part of the current delivery** and would need to be scoped and agreed separately:

- A proper Role Management screen, since the backend already supports it.
- A real video-hosting integration to replace the local-only stub.
- A Batch Director-facing Notices page, and a decision on how "Staff"-targeted notices should surface.
- Deployment packaging (Docker/CI) for repeatable releases.
