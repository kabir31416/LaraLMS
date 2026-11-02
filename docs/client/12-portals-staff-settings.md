# 12. Login Portals, Student Dashboard, Staff Management & Smart Settings (v1.5)

This document covers the v1.5 UI update: the blue theme, the public homepage, the three login routes, the redesigned Student Dashboard, Staff Management and Settings. Business and financial logic did not change. The one backend change is an optional, additive check on Admin login (§12.4).

## 12.1 Audit summary (before the change)

| Area | What existed | Decision |
|---|---|---|
| Auth | Admin: `POST /auth/login` (identifier + password, JWT + refresh cookie). Student: `POST /auth/student-login` (phone + roll/registration no., no password). Staff: `POST /auth/staff-login` (phone + Staff ID, no password). One `/login` page with three tabs. | Reused all three as they are. No new auth system or user model. |
| Role routing | `ProtectedRoute` + `homeRouteFor(role)`: Admin → `/`, Batch Director → `/director`, Mess staff → `/mess`, Student → `/student`. | Reused. Unauthenticated users now go to the matching portal. |
| Student data | `/students/me` (profile + denormalised batch), attendance, results, exams, payments, notices, material history, `/mess/portal/me`. | Dashboard reads only these. No new endpoints. |
| Staff | `StaffContext` (`/staff`), `StaffForm`, Batch Director ↔ batch assignment, Mess ↔ staff assignment, `/users/:id/reset-credentials` (Super Admin for Admin logins), staff audit log. | Reused. Presentation redesign only. |
| Settings | Ten tabbed sections, each with its own API and backend permission. Mess Settings lives at `/mess/settings`. | Same tabs and APIs, reorganised (§12.7). |

## 12.2 Theme

The global tokens are in `src/index.css`. Components use the tokens, so the whole app changed together.

| Token | Value | Use |
|---|---|---|
| `--primary` | `224 76% 46%` (royal blue) | Buttons, links, active navigation, focus ring |
| `--secondary` / `--accent` | soft blue (`220 45% 95%`) | Secondary buttons, hover, chips |
| `--background` | `220 33% 98%` (light blue-gray) | Page background; cards are white |
| `--foreground` | `222 47% 11%` (dark navy) | Text |
| `--border` | `220 20% 90%` (gray-blue) | Borders and dividers |
| Sidebar | Blue active state | Navigation |

Success, warning and danger colours are unchanged, so status meaning is unchanged. PDF headers (receipts, marksheets, exports) use a dark navy header bar to match.

## 12.3 Homepage and login routes

| Route | Page | Who |
|---|---|---|
| `/` | Public **login portal**: institution branding, three portal buttons, public links, footer with institution address/phone/website. A signed-in user is sent to their own home; an Admin sees the Admin dashboard here as before. | Everyone |
| `/studentLogin` | Student login: mobile number + registration number | Students |
| `/staffLogin` | Staff login: mobile number + Staff ID | Batch Directors, Mess staff |
| `/adminLogin` | Admin login: mobile/ID + password, with show/hide password | Admin-type users |
| `/login` | Old URL. Redirects to `/` (or to the matching portal for `?tab=student|staff|admin`). | Old bookmarks |

The homepage reads only `GET /public/institution` (public branding). It shows no protected data.

**Login page behaviour**

- Each page validates its fields first. Mobile numbers accept Bengali digits and `+880`, and are normalised before sending.
- Errors appear inline under the field, and as a clear alert for server errors.
- The submit button shows a loading state.
- After login the user goes to the `?next=` page when it is a safe in-app path, otherwise to their own home. External URLs such as `//evil.com` are ignored.
- An already signed-in user who opens a login page is sent to their own home.
- Each page links to the other two portals.
- There is no "Forgot password" link. The system has no self-service password reset. A Super Admin resets Admin passwords from Staff Management (§12.6).

**Protected-page redirects:** `/student/*` → `/studentLogin`; `/director/*` and `/mess/*` → `/staffLogin`; every other admin page → `/adminLogin`. Each redirect carries `?next=` so the user returns to the page they asked for.

## 12.4 Role-mismatch protection

- **Student and Staff portals.** These were already role-specific on the server. The student endpoint only matches Student records; the staff endpoint only matches Staff records.
- **Admin portal (new).** The page sends `portal: "admin"` with `POST /auth/login`. The server then refuses student, batch_director and mess_* accounts with **403**, "এটি এডমিন অ্যাকাউন্ট নয় — নিজের পোর্টাল … ব্যবহার করুন", and writes an `auth.login-wrong-portal` audit entry.
  - The check runs after the password check, so a wrong password still gets the same generic 401 and nothing is revealed.
  - No token is issued.
  - Requests without `portal` behave exactly as before, so older clients keep working.
  - Files: `backend/src/modules/auth/auth.{validation,controller,service}.ts`.
- **Frontend routing.** The frontend also redirects users who open another role's pages. This is convenience only; every API still enforces permissions on the server.

## 12.5 Student Dashboard (`/student`)

Every figure comes from the student's own data. Empty data shows an empty state, never a placeholder number.

| Section | Source |
|---|---|
| Welcome banner, photo/initials, registration no., system ID, course, batch | `GET /students/me` |
| Profile completion (12 fields) and the missing items | `/students/me` |
| Quick actions | Profile, Results, Attendance, Fees & Payments, Marksheet, Materials, Notices, and My Mess (only for Mess members) |
| KPIs: attendance %, average score, paid, due | Attendance entries, results joined with exams, student fee totals |
| Next class | The batch's weekly days and time |
| Upcoming exams | Exams for the student's batch dated today or later |
| Recent results | Results with marks and full marks |
| Attendance meter and last 10 days | Attendance entries |
| Fees & recent payments | Payments with receipt links |
| Notices | Notices filtered for this student (all / course / batch) |
| Materials received | Material distribution history (reversed entries excluded) |
| Mess (members only) | `GET /mess/portal/me` |

## 12.6 Staff Management (`/staff`)

- **Overview cards.** Total (with active count), Teachers, Batch Directors, Mess staff, Admin & other. Clicking a card filters the list.
- **Recent changes.** The last staff create, update and delete entries from the existing audit log. Shown only to users allowed to read the audit log.
- **List.**
  - Search by name, mobile, email or Staff ID.
  - Filters for type (including "all Mess staff") and status.
  - 20 per page, with active staff first.
  - Desktop shows a table: photo, name, email, Staff ID, type badge, phone, assignment, join date, status, actions.
  - Mobile shows a card list.
- **Profile drawer** (click a row). Staff ID, mobile, email, address, join date, salary, assignment (batches for Batch Directors, Messes for Mess staff, with links to assign), portal access type, status.
- **Actions.**

  | Action | What it does |
  |---|---|
  | Add | Existing `StaffForm` |
  | Edit / responsibilities | Existing `StaffForm`, including type and module access for Admins |
  | Activate / Deactivate | Existing staff update with `status`. A deactivated staff member cannot sign in to the portal. |
  | Delete | Now asks for confirmation |
  | Reset login password | **Super Admin only, for Admin-type staff.** Uses the existing `PATCH /users/:id/reset-credentials`, which is audited on the server. |

  Admin-type staff can still only be edited or deleted by the Super Admin, as before. The server enforces this; the UI mirrors it.
- **No changes to stored data.** Staff IDs, roles and stored data are unchanged.

## 12.7 Smart Settings (`/settings`)

- **Overview.** Grouped category cards:
  - Institution & Students
  - Academic & Results
  - Finance & Operations
  - Communication, Public & Security
  - Settings on other pages: links to Mess Settings and Staff & access
- **Search.** Matches labels, descriptions and Bengali/English keywords (e.g. "লোগো", "grade", "SMS").
- **Permissions.**
  - A category appears only when the user holds one of its backend permissions:

    | Category | Permission(s) |
    |---|---|
    | Institution, Student, Result, Class/Exam | `settings:manage` |
    | Academic | Also `sessions:` / `courses:` / `subjects:` / `lectures:manage` |
    | Finance | Also `payment-methods:manage` |
    | Materials | Also `material-types:manage` |
    | SMS | `sms:manage` |
    | Public | Also `public-info:manage` / `public-results:manage` |
    | Audit log | Also `audit:read` |

  - Every save is still authorised by the server.
- **URL state.** `/settings?section=institution` and so on. Unknown or forbidden sections fall back to the overview.
- **Unsaved changes.**
  - Forms that edit values report "dirty" state: Institution, Student ID prefix, Result rules, Admission fee, Material minimum stock, and SMS provider credentials.
  - A dirty form shows an "অসংরক্ষিত পরিবর্তন আছে" note and a **বাতিল** (cancel) button that restores the saved values.
  - Save is disabled until something changes.
  - Switching category asks before discarding changes.
  - Closing or reloading the tab triggers the browser's leave-page warning.
- **Validation.**
  - Result rules: pass % between 0 and 100, exam duration above 0, grade names required, grade thresholds between 0 and 100 and unique.
  - Admission fee and minimum stock cannot be negative.
- **Audit trail.** Unchanged. Settings saves are audited by the server, and the Audit Log category shows them.
- **Secrets.** SMS API keys are write-only. The server returns only "configured" and a masked hint, never the key, and audit entries are redacted.
- **Existing values.** All existing setting values are kept. Nothing is migrated or reset.

## 12.8 Navigation

- The sidebar was already role-aware (v1.3) and is unchanged.
- Logout returns to the homepage portal.
- In-page "login" links and guards that pointed to `/login` now point to the right portal: Student pages → `/studentLogin`, Director pages → `/staffLogin`, Admin-only pages → `/adminLogin`, and pages shared by Admin and Director → `/`.

## 12.9 Verification performed

| Check | Result |
|---|---|
| Frontend typecheck (`tsc -p tsconfig.app.json`) | Pass |
| Backend typecheck (`tsc --noEmit`) | Pass |
| Production build (`vite build`) | Pass |
| Lint | 4 errors, all pre-existing in files not touched by this change (`ui/command.tsx`, `ui/textarea.tsx`, `StudentVideos.tsx`, `tailwind.config.ts`); 0 new |
| Admin-portal check, database-free (model calls stubbed) | **13/13 pass**: 403 and audit for student / batch_director / mess roles; generic 401 on wrong password; admin roles pass; no `portal` means unchanged behaviour |
| Browser flow tests (Playwright, mocked API) | **47/47 pass**: homepage buttons and footer; 9 redirect cases including old `/login`; empty-form validation; password toggle; wrong-portal and wrong-password errors; `portal=admin` sent; `?next=` honoured; unsafe `next` ignored; staff login with Bengali digits; student login; a signed-in student blocked from admin pages; student dashboard shows real fixture data; settings search, URL state, dirty guard, cancel, fallback; staff search, profile drawer, delete confirmation |
| Responsive sweep (homepage, 3 login pages, student dashboard, staff, settings and two sections, admin and Mess dashboards) | No horizontal overflow and no page errors at 320, 375, 414, 768, 1024, 1440 and 1920 px |

## 12.10 Limitations

- **🔵 No live database test.** The tests ran against a mocked API and stubbed models, not a running MongoDB. Log in once on each portal against a staging database before go-live.
- **No self-service "forgot password".** None exists in the system, so none was added. Admin passwords are reset by the Super Admin.
- **Unsaved-changes guard scope.** The guard covers switching categories and closing or reloading the tab. Clicking a sidebar link to another page while a settings form is dirty is not intercepted, because the app uses `BrowserRouter`, not a data router.
- **Class / Exam list.** The "ক্লাস / এক্সাম" settings list is still stored in the browser (pre-existing, `AcademicContext` mock store) and is not shared between devices. It was left as it was.
- **Mess staff assignment.** A Mess staff member's assignment in Staff Management shows only for users who can view Mess data.
