# Integration & Refactoring Plan

Goal: turn the existing LMS into a clean, dynamic, consistent ERP without adding features or redesigning UI. All existing data + features preserved.

## Phase 1 — Audit findings (already mapped)

Duplicates / issues discovered:

- **Batch/course/subject data is hardcoded** in several forms (`StaffForm`, `AdmissionForm`, filters) instead of pulled from `AcademicContext` + `BatchContext`.
- **Two Student profile pages** (`pages/StudentProfile.tsx` admin view, `pages/student/StudentProfile.tsx` self view) share ~80% layout. Extract shared `StudentProfileView`.
- **Two Attendance UIs** (`Attendance.tsx` admin analytics, `DirectorAttendance.tsx` entry). Keep both but share hooks/utils via `lib/attendance.ts` (compute %, low-attendance, top-N).
- **Two Results entry points** (Director `DirectorResults.tsx`, admin `Exams.tsx`). Consolidate result-calc helpers in `lib/results.ts`.
- **Dashboard cards duplicated** across `Index.tsx` and `DirectorDashboard.tsx`. Extract `<StatCard>` usage into shared `dashboard/` widgets: `RecentAdmissions`, `RecentPayments`, `RecentAttendance`, `RecentResults`, `LatestNotices`.
- **Batch selectors** re-written in 4 places → single `<BatchSelect />` component.
- **Course/Session/Subject/Lecture selects** re-written in forms → single `<AcademicSelect kind="course|subject|..." />`.
- **Provider tree** deeply nested & inconsistent order → flatten into a single `<AppProviders>` wrapper.
- **Sidebar** has `BarChart3` imported twice (once aliased). Clean icon imports.
- **Router** has repetitive `ProtectedRoute` wrappers → group with nested `<Route element={<ProtectedRoute .../>}>`.
- **Types**: student `batch` is a string, but `BatchContext` is the source of truth → deprecate `student.batch` reads, always resolve via `getBatchByStudent`.
- **Dead code**: unused imports in `Index.tsx`, `StudentContext` exposes `getAttendance/getResults` from mock maps that are shadowed by `AttendanceContext` — remove and route callers to `AttendanceContext`.
- **Reports**: 8 tabs each re-implement toolbar wiring → already have `ReportToolbar`, but table rendering repeats. Extract `<ReportTable columns rows />`.

## Phase 2 — Execution order (module by module)

Each step: refactor in place, verify build, keep UI identical.

1. **Foundation**
   - `src/components/AppProviders.tsx` — flatten context tree, fix provider order (Auth → Academic → Staff → Batch → Student → Book → Accounts → BranchLedger → Attendance → Notice → Routine).
   - `src/routes.tsx` — extract Routes, group by role using nested `ProtectedRoute` layout routes.
   - Clean `AppSidebar.tsx` icon imports.

2. **Shared primitives** (`src/components/common/`)
   - `AcademicSelect.tsx` (session/course/subject/lecture)
   - `BatchSelect.tsx`
   - `StaffSelect.tsx`
   - `PageHeader.tsx` (unify page titles/actions)
   - `DataTable.tsx` thin wrapper over existing table styles used by Students/Staff/Books/Reports

3. **Dashboard consolidation**
   - `src/components/dashboard/` widgets: `RecentAdmissions`, `RecentPayments`, `RecentAttendance`, `RecentResults`, `LatestNotices`, `AttendanceTrendChart`, `MonthlyCollectionChart`.
   - `Index.tsx` and `DirectorDashboard.tsx` re-composed from these widgets. Remove duplicate stat cards; keep only the meaningful set the user listed.

4. **Master data (Settings)**
   - Ensure `AcademicContext` exposes stable getters (`getCoursesBySession`, `getSubjectsByCourse`, `getLecturesBySubject`) — add missing ones.
   - Replace hardcoded course/subject/batch/branch arrays in: `AdmissionForm`, `StaffForm`, `StudentFilters`, `BatchForm`, `RoutineForm`, `Exams`, `VideoClasses`, `DirectorResults`, report filters.

5. **Students / Admission / Profile**
   - Extract `StudentProfileView` used by both admin & self pages.
   - Route admin `StudentProfile` → uses view + admin actions; student self page → view only.
   - Move payment/attendance/result reads to their respective contexts (drop `StudentContext.getAttendance/getResults` mock passthroughs).

6. **Fees / Accounts / BranchLedger**
   - Verify `AccountsAutoBridge` still bridges payment → account entries after refactor.
   - Extract shared money-formatter to `lib/format.ts` (`formatBDT`, `toBanglaNumber`).

7. **Attendance & Results**
   - `lib/attendance.ts`: `computeStudentAttendance`, `getLowAttendance`, `getTopByAttendance`, `dailyTrend`.
   - `lib/results.ts`: `computeAverageMark`, `passFail`, `latestResult`.
   - Refactor `Attendance.tsx`, `DirectorAttendance.tsx`, `DirectorResults.tsx`, student pages, dashboards to consume these.

8. **Books / Staff / Batch / Routine / Notices / Reports**
   - Replace inline selects with shared components.
   - Reports: extract `ReportTable`; each report becomes ~30 lines.

9. **Cleanup pass**
   - Remove unused imports, unused state, dead files.
   - Run `tsgo` + build to confirm zero regressions.
   - Manual click-through of every route (admin, director, student) via Playwright screenshot sweep.

## Phase 3 — Non-goals (explicit)

- No new pages, no new features, no schema changes.
- No visual redesign — Tailwind classes and shadcn components stay; only extraction/reuse.
- No dependency changes beyond removing unused ones.

## Deliverable

A PR-sized set of edits, module by module, each preserving behavior. Final state: single `<AppProviders>`, single `routes.tsx`, shared selects, shared dashboard widgets, shared attendance/result utilities, zero hardcoded master data, consistent icon/table/button usage.

Given the scope (~40 files touched), I will proceed in the order above and check in after each phase so you can verify UI parity before I continue.
