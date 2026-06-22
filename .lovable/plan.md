## Scope
Extend the existing LMS (no module recreation) with three new feature areas plus a richer Admin Dashboard. UI stays Bengali / Hind Siliguri.

---

### 1. Student Portal (new role)

**Auth**
- Extend `AuthContext` with a third role `"Student"`. Login on `/login` adds a "শিক্ষার্থী লগইন" tab where the student enters Student ID + Mobile; we match against `StudentContext.students`. On success store `{ studentId, name, role: "Student" }`.
- `ProtectedRoute` already supports role gating — add `"Student"` routes.

**Routes (`/student/*`)**
- `/student` Dashboard — cards: Attendance %, Total Paid, Total Due, Latest Result.
- `/student/profile` — personal, guardian, course, batch info (read from existing student record + `BatchContext`).
- `/student/attendance` — % + monthly breakdown + history (from `AttendanceContext` + legacy `getAttendance`).
- `/student/results` — subject / lecture / exam history (from `AttendanceContext` offline results + legacy `getResults`).
- `/student/payments` — payment list with receipt no + due (from `StudentContext.getPayments`).
- `/student/books` — assigned books + issue history (from `BookContext`).
- `/student/videos` — course videos with subject filter (from `AcademicContext` video classes).
- `/student/notices` — notices targeted at the student (see §2).

Sidebar: when role === Student, show a Student-specific menu in `AppSidebar` (same pattern as the Director menu).

---

### 2. Notice System

- New `src/types/notice.ts` + `src/contexts/NoticeContext.tsx` (localStorage persisted, demo seed).
- Fields: title, description, type (`All | Course | Batch | Staff | Director`), targetId (course/batch), publishDate, expiryDate, priority (`Normal | Important | Urgent`), pinned.
- New page `/notices` (Admin) with create / edit / delete / pin, sidebar entry "নোটিশ".
- Visibility helper `getNoticesFor(user, student?)` used by Student portal, Director dashboard, and a small "Latest Notices" widget on Admin dashboard.

---

### 3. Report Center

- New page `/reports` with shadcn `Tabs` for the 8 reports listed.
- Each tab is a small component under `src/components/reports/`:
  AdmissionReport, FeeCollectionReport, DueReport, AttendanceReport, ResultReport, BookDistributionReport, StaffReport, BranchLedgerReport.
- Data sourced entirely from existing contexts — no new storage.
- Shared toolbar `ReportToolbar` with **Print / PDF / Excel** buttons:
  - Print → `window.print()` scoped via a `.printable` class.
  - Excel → existing `xlsx` dep (`utils.json_to_sheet` + `writeFile`).
  - PDF → add `jspdf` + `jspdf-autotable` (small, no native deps) and render the current table.
- Sidebar entry "রিপোর্ট".

---

### 4. Admin Dashboard update (`src/pages/Index.tsx`)
Extend the existing dashboard (don't rewrite):
- Cards row: Total Students, Active Batches, Today's Collection, Total Due, Today's Attendance.
- Sections: Recent Admissions, Recent Payments, Latest Notices, Top 10 by Attendance.
- Charts (Recharts, already used): Monthly Collection (bar), Attendance Trend (existing — keep).

---

### Technical notes
- New deps: `jspdf`, `jspdf-autotable`. `xlsx` already installed.
- All new contexts plugged into `App.tsx` provider tree.
- `AppSidebar` gets a `studentMenu` and switches by `user.role`.
- No DB / schema changes — pure frontend extension on localStorage data, consistent with existing pattern.

### Files (high-level)
**New:** `src/contexts/NoticeContext.tsx`, `src/types/notice.ts`, `src/pages/Notices.tsx`, `src/pages/Reports.tsx`, `src/components/reports/*` (8 tabs + ReportToolbar + export utils), `src/pages/StudentDashboard.tsx`, `src/pages/StudentProfileSelf.tsx`, `src/pages/StudentAttendance.tsx`, `src/pages/StudentResults.tsx`, `src/pages/StudentPayments.tsx`, `src/pages/StudentBooks.tsx`, `src/pages/StudentVideos.tsx`, `src/pages/StudentNotices.tsx`, `src/lib/exporters.ts`.
**Edited:** `src/App.tsx` (providers + routes), `src/contexts/AuthContext.tsx` (Student role + loginAsStudent), `src/pages/Login.tsx` (student tab), `src/components/AppSidebar.tsx` (student menu + নোটিশ / রিপোর্ট), `src/pages/Index.tsx` (dashboard upgrade).
