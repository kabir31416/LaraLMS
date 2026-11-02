# Document 11 — UI/UX Modernization & Dashboards

What changed in the interface, and where every dashboard number comes from.

## 11.1 Design system

| Element | Rule |
|---|---|
| Palette | White surfaces, soft warm-neutral gray background, charcoal text, silver hairlines, **deep orange** (`--primary`) as the only accent. |
| Meaningful colour | Orange = primary action/highlight · Green = success/paid · Red = due/error/critical · Amber = warning/pending · Gray = secondary info. The old cyan "info" colour is now a neutral charcoal-gray. |
| Shape & depth | Radius 0.5rem (was 0.75rem). Shadows reduced to a hairline elevation; cards rely on a border first. |
| Typography | Hind Siliguri everywhere (unchanged), tighter heading tracking, tabular numbers in tables and figures. |
| Tables | Muted header band, smaller semibold column labels, tighter rows, softer row hover — applied globally through the shared Table component (every module). |
| Forms | Softer focus ring on inputs/selects/textareas, hover border, consistent keyboard focus outline app-wide. |
| Dialogs | Lighter overlay with a faint blur; existing viewport-fit/scroll behaviour kept. |
| Tabs | Tab bars scroll horizontally on phones instead of overflowing the page. |
| Charts | Single orange series, no dual axes, ranked single-hue bars instead of pies, two-part meters with direct labels, hover tooltips on every chart. |
| Accessibility | Visible focus states, `prefers-reduced-motion` respected, status shown with text/icons as well as colour, labelled controls. |
| PDF exports | Table header colour changed from blue to charcoal. |

Tokens live in `src/index.css`; elevation and chart colours in `tailwind.config.ts`.

## 11.2 Global layout

- **Sidebar.** Navigation is grouped into sections: Main, Students, Academic, Finance, Mess, Administration.
  - The active page is marked by an orange bar and tint.
  - The sidebar collapses to icons with tooltips. On phones it is a drawer that closes after you navigate.
  - Items are filtered exactly as before: by role, plus each Admin's own per-module permissions.
  - The catalog lives in `src/lib/navigation.ts` and is shared by the sidebar, the search and the breadcrumb.
- **Header.**
  - **Breadcrumb**: section › page.
  - **Global search** (Ctrl/⌘+K): replaces the old search box, which did nothing.
    - Jumps to any page you are allowed to open.
    - Admins can also search students in the real student list (name, Registration ID, roll, phone, guardian phone) and open the profile. Only 6 results are fetched per search.
  - **Notification bell**: now opens the notices page. The old red dot was decorative and has been removed.
  - **Account menu**: shows your name, role and login. "Change password" is offered only for Admin logins; portal logins have no password.
- **Content width** is capped on very large screens, with consistent gutters on phones.

## 11.3 Main Admin Dashboard (`/`)

All figures come from a new server-side endpoint, `GET /dashboard/overview`. It takes a date range plus optional course and batch filters, and returns each section **only if the Admin holds that module's permission**. A restricted Admin sees fewer sections, never data they couldn't otherwise open.

| Section | Source of truth |
|---|---|
| Header: greeting, date, current session, institute | Settings (default session) and Institution Settings. |
| Filters: date-range presets or custom (max 1 year), course, batch, refresh | Sent to the server. Preferences are not persisted; the app has no preference store. |
| Quick actions (up to 8) | Shown only when you hold the action's permission. All link to existing pages. |
| Needs attention | Pending student applications, students with dues, low-attendance students, today's exams, today's birthdays, low/out-of-stock materials. |
| Students: total / active / new / inactive | Student collection. Pending/rejected public applications are excluded. "New" is compared with the previous period of equal length. |
| Finance: today / this month / total due / discounts | Payment transactions (cancelled payments excluded) and the students' own due and discount totals. "This month" is compared with the same days of last month. |
| Academic: active courses / batches / today's attendance / upcoming exams | Course, Batch, AttendanceEntry and OfflineExam collections. |
| **Mess Management** | Mess module's own scope-aware endpoints (see §11.4). |
| Financial analytics | Collection for the range: daily for ranges up to 3 months, otherwise monthly. Also a 12-month trend, collection by course, by payment method and by source, and due vs. paid. |
| Student analytics | 12-month admission trend, active vs. inactive, course-wise and batch-wise distribution, recent admissions. |
| Attendance & academic | Attendance trend, batches with the lowest attendance, upcoming exams, recent exams with result counts and published state. Shortcuts to Result Management and Marksheet. |
| Recent activity | Real AuditLog entries for operational events (admission, payment, enrollment, exam/result, material, notice, Mess). Shows type, description, user and time. Requires the Audit permission. |

**Dates.** "Today" and "this month" are computed in the institution's timezone (`APP_TIMEZONE`, default `Asia/Dhaka`). Before this change the server used UTC, which was a day behind between 00:00 and 06:00 local time. The existing `/dashboard/admin`, `/dashboard/admission` and `/dashboard/director` summaries and the Mess module now use the same rule.

**Freshness.** Dashboard data is cached for 30 seconds through the app's existing React Query client. It is refetched every time the dashboard opens, and on the refresh button, so figures update after a payment or admission elsewhere.

## 11.4 Mess shortcut on the Main Dashboard

Admins see a **"মেস ম্যানেজমেন্ট"** panel only when they hold Mess access (`mess:view`). It contains:

- **Active Mess locations**: count, seats, and the current period.
- **Members and seats**: active members, occupied and available seats with the occupancy rate, and a seat-status bar.
- **Money**: this month's rent collection, total Mess due and this month's approved expenses. These are shown **only if the server says this role may see Mess money**.
- **Pending work**: applications, open complaints and expenses awaiting approval.
- **Per-Mess breakdown**: one row per Mess. Clicking a Mess opens the Mess Dashboard already filtered to it.
- **Actions**: "Open Mess Dashboard" (`/mess`) plus quick actions for Members, Rooms & Seats, Billing & Payments and Expenses, each permission-gated.

If no Mess exists yet, an empty state appears. It includes a shortcut to Mess setup only for users who can create a Mess.

**Mess staff** (Manager/Accountant/Caretaker) use their own Mess Dashboard as home. Every figure there is server-scoped to their assigned Mess(es). The `/mess/dashboard` endpoint now returns money fields as empty for roles without Mess financial permission, so a Caretaker sees occupancy and complaints only.

## 11.5 Role dashboards

| Role | Dashboard |
|---|---|
| Admin / Super Admin | Main Dashboard above. |
| Batch Director | Assigned batches as cards (course, schedule, room, students, 30-day attendance), today's and overall attendance, upcoming and recent exams, low-attendance students. Everything is scoped to the director's batches. |
| Mess staff | Mess Dashboard: occupancy, members, pending work, due members, recent payments or open complaints, according to permission. |
| Student | Attendance, paid and due, latest result, course and batch, fee status meter. Shows "My Mess" **only when the student has an active Mess membership**, read from the student's own portal endpoint. |

**Accountant.** There is no separate coaching "Accountant" login in this ERP. An Admin restricted to the finance modules (per-Admin module picker) gets a finance-only Main Dashboard automatically, because sections follow permissions. Mess Accountants have the Mess Dashboard.

## 11.6 Verification

**Ran:**

- `tsc --noEmit` for frontend and backend: pass.
- `vite build`: pass.
- ESLint:
  - Backend: 0 errors (only its 3 pre-existing warnings).
  - Frontend: 0 new errors. The 3 that remain are pre-existing, in untouched files.
- Responsive render check of the production build in headless Chromium at **320, 375, 414, 768, 1024, 1366 and 1920 px**.
  - Pages: Admin Dashboard, Mess Dashboard, Students, Fees, Settings, Reports, Director Dashboard and Student Dashboard.
  - The API was **mocked with fixtures**; no real database was used.
  - Result: no horizontal page overflow at any width, and no runtime errors once fixtures matched each page's data shape.

**Not run:**

- Against a live database.
- Interaction tests of every workflow.

The dashboard numbers come from aggregations reviewed in code, not from a live dataset. Check them against Fee Management, Attendance and the Student list on a test database before go-live.
