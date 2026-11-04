# 13. Student Performance Analytics & Student Portal (v1.6)

Student Performance Analytics for Admins and Batch Directors, plus a redesign of every Student Portal page. All figures come from the existing Results, Attendance, Exam, Student, Course and Batch data. There is no new academic data store, and analytics never changes a mark, an attendance entry or a batch.

## 13.1 Audit findings (before the change)

| Area | Finding | Decision |
|---|---|---|
| Results | `OfflineExam` (batch, subject, fullMarks, date) + `OfflineResult` (examId, studentId, marks; `null` = absent). The marksheet (`publicResults.service.ts`) ignores invalid marks, doesn't count an absence as zero, and computes overall % as Σ obtained ÷ Σ full. Grades come from `Settings.gradeScale`; pass/fail from `passingPercentage`. | Analytics uses the same rules. |
| Attendance | `AttendanceEntry` (student, batch, date, Present/Absent, Manual/Exam). Every report computes % = round(present ÷ total × 100). | Same formula. |
| Relationships | Session → Course (`course.sessionId`) → Batch (`batch.courseId`); a student's current batch is `student.currentBatchId`. | Filters follow this chain. |
| Batch Directors | `Batch.directorIds` holds the Staff ids. Directors already hold `results:read` / `attendance:read`. | Analytics limits them to their batches inside every query. |
| Student Dashboard | Average was the mean of per-exam % (disagreed with the marksheet). Profile completion used its own 12-field list (disagreed with the Profile page). | Both now use the server's values. |
| Student pages | 9 pages under `/student/*` with plain tables. `StudentVideos` called a hook conditionally (lint error). The printable marksheet and `printReport` wrote unescaped names into a same-origin print window. | All redesigned; lint error fixed; print output escaped. |

**Student Portal inventory (all redesigned).** The pages are:

- `/student` — Dashboard
- `/student/profile` — Profile view and edit
- `/student/results` — Results, plus the marksheet via `?view=marksheet`
- `/student/attendance`
- `/student/payments` — Fees and payment history
- `/student/books` — Materials
- `/student/videos` — Video classes
- `/student/notices`
- `/student/mess`

The receipt page (`/payments/:id/receipt`) is a print document and keeps its layout.

## 13.2 New endpoints (read-only)

| Endpoint | Who | Purpose |
|---|---|---|
| `GET /api/v1/analytics/performance` | `results:read` (Admin; Batch Director limited to own batches) | Summary cards, charts and the paginated student list, all filtered on the server. Filters: `sessionId`, `courseId`, `batchId`, `studentId`, `q` (registration no. / roll / name), `examId`, `subjectId`, `dateFrom`, `dateTo`, `attendanceMin`, `attendanceMax`, `status`. Also `sort`, `page`, `limit` (max 100), `fresh=1` and `export=1` (whole filtered list, max 5,000). |
| `GET /api/v1/analytics/performance/options` | same | Filter options limited to the caller's scope. Exams are listed only once a course or batch is chosen. |
| `GET /api/v1/analytics/performance/students/:id` | same; a director only for students currently in their batches (otherwise 403) | One student's profile: exam-wise, subject-wise, attendance, trend and at-risk reasons. |
| `GET /api/v1/analytics/performance/me` | `results:read:own` (Student) | The signed-in student's own figures. Identity comes from the session; there are no at-risk labels and no rankings. |

**Implementation and performance:**

- The code is in `backend/src/modules/analytics/`. The pure rules are in `performance.rules.ts`; queries and scoping are in `performance.service.ts`.
- Each request uses one grouped aggregation for results and one for attendance, so there are no per-student queries. Existing indexes cover these queries (`OfflineResult {examId, studentId}`, `AttendanceEntry {studentId, date}`, `OfflineExam {batchId, date}`, `Student {currentBatchId, …}`).
- Computed results are cached in memory for at most 60 seconds per scope and filter set. Paging and sorting don't recompute.
- Saving results, attendance or settings clears that cache, and the page's **রিফ্রেশ** button always recomputes.

**Other backend changes:**

- `Settings.performanceRules` stores the thresholds below. It is optional, and readers merge it over the defaults.
- `PATCH /settings` accepts `performanceRules` with validation; it requires `settings:manage` and is audited.

## 13.3 Calculation rules

| Indicator | Rule |
|---|---|
| Overall % | Σ obtained ÷ Σ full marks over exams sat (same as the marksheet). Invalid rows are ignored; an absence is not a zero. |
| Grade / pass | `Settings.gradeScale` / `passingPercentage`. |
| Performance band | Excellent ≥ 80 %, Good ≥ 60 %, Average ≥ 40 %, otherwise Needs improvement. Fewer than 2 exams sat → "Not enough data". |
| Trend | Pooled % of the last 3 exams sat minus the 3 before (or half-and-half when fewer, minimum 2 + 2). A change of ±5 points or more → Improving / Declining; otherwise Stable. Fewer than 4 exams sat → "Not enough data". |
| Attendance | present ÷ total, rounded; "low" when below 75 % over at least 5 days. Marks and attendance stay separate indicators. |
| Summary averages | Pooled over the filtered students (Σ ÷ Σ). They show "—" with an explanation when there is no data, never 0 %. |

**At-risk** means *needs attention*. A student is flagged when **any** of these rules fires, and every flag shows the reason in words:

1. Attendance below 75 % (at least 5 days of data).
2. 2 or more of the last 5 exams sat are below the pass mark. The count can't be set below 2, so a single low mark never flags a student.
3. The recent average dropped by 10 or more points (needs 2 exams in each window).
4. Recorded absent in 2 or more of the last 5 result entries. Only explicit absent records count; an exam with no result row (e.g. the student joined later) is never assumed missed.

All thresholds can be changed in **Settings → ফলাফল → পারফরম্যান্স অ্যানালিটিক্সের নিয়ম** (`settings:manage`, audited).

At-risk is a decision-support label only. Nothing is changed automatically, and it is never shown to students.

## 13.4 Admin / Director analytics page

- **Where:** Admin `/analytics` (sidebar → একাডেমিক → পারফরম্যান্স অ্যানালিটিক্স; it follows the existing "exams & results" module permission). Batch Director `/director/analytics`.
- **Filters:**
  - Search by registration no., roll or name.
  - Performance status.
  - A filter panel with session → course → batch (dependent), subject, exam (once a course or batch is chosen), date range and attendance range.
  - All filters are kept in the URL.
- **Eight summary cards:** active students, average marks, average attendance, at risk, improving, declining, low attendance, not enough data. Clicking a card filters the list.
- **Charts:** exam-wise average trend (with the pass line), monthly attendance (with the low-attendance line), subject comparison, batch comparison (click to filter), and improving / stable / declining / not-enough-data.
- **Student list:**
  - Sortable: risk first, marks, attendance, biggest decline, name.
  - Server-paginated; cards on mobile.
  - Shows the status badge and the reasons.
- **Drill-down drawer:** overall and grade, attendance, highest/lowest, exam-wise trend, subject-wise, attendance split, recent exams, and links to the existing Student Profile → Results / Attendance tabs (`?tab=` now supported).
- **Export:** filtered list to Excel, filtered list print, and at-risk list print. Printing is used instead of jsPDF PDF because jsPDF can't render Bengali text.
- **"কীভাবে গণনা করা হয়" panel:** explains the active thresholds.

## 13.5 Student Portal

- **Shared kit** (`components/student/StudentPortalKit.tsx`): a Student-only guard, page header (icon, title, description, actions), loading skeletons, error state with retry, a `useMyPerformance()` hook and `MiniStat`. Charts and badges come from `components/analytics/PerformanceKit.tsx`.
- **Navigation groups:**
  - ওভারভিউ
  - একাডেমিক: Results & Marksheet, Attendance, Video classes, Materials
  - আর্থিক: Fees & Payments
  - যোগাযোগ: Notices
  - আমার তথ্য: Profile, Mess

  Routes are unchanged.
- **Dashboard:**
  - Overall %, grade and trend come from `/me`.
  - New "আমার পারফরম্যান্স" panel with a trend chart and recent exams.
  - Attendance % comes from the server.
  - Profile completion is the server's figure, with missing items named.
  - The marksheet quick action opens the marksheet tab.
  - No at-risk labels and no other students' data.
- **Results & Marksheet:**
  - Overall, grade and result, highest/lowest, and trend.
  - Exam trend chart and subject-wise bars (click to filter).
  - Exam history: searchable, with a subject filter, table on desktop and cards on mobile; shows obtained/full, %, grade, and pass / fail / absent.
  - Marksheet tab with totals; printing uses the existing marksheet print renderer.
- **Attendance:** server totals; monthly trend; month list; a month calendar (present / absent / no data, with text labels) and a list view with month navigation.
- **Fees & Payments:**
  - Payable, paid and due come from the student record; fee status and a paid-vs-due meter are shown.
  - History shows receipt no., date, type, method, amount and status (cancelled payments are marked), with a receipt link.
- **Materials:** card list with type, free/paid, quantity and date; reversed items are marked; totals; search.
- **Video classes:** card grid with subject filter and search. The conditional-hook bug is fixed.
- **Notices:** readable cards with pinned, priority, audience, publish and expiry dates; search.
- **Profile:**
  - Identity header with photo upload and server completion.
  - "তথ্য" tab with grouped read-only sections.
  - "সম্পাদনা" tab with the same fields and the same required-field validation as before, grouped as guardian, address, HSC, SSC.
  - Dirty indicator, cancel, leave-page warning; save is enabled only after a change.
- **Mess:** shared header; content unchanged.

## 13.6 Security & privacy

- **Batch Directors:**
  - Their scope is computed on the server from `Batch.directorIds`.
  - A batch id outside their scope returns 403.
  - A student outside their batches returns nothing in the list and 403 on the profile.
  - Filter options only list their own batches and courses.
- **Students:** blocked from every staff analytics endpoint (403). `/me` reads the id from the session, never from a URL or query.
- **Fields returned:** list rows carry no phone or guardian fields.
- **Frontend routing:**
  - `/analytics` requires `results:read`.
  - `/director/analytics` is Director-only.
  - `/students/:id` is now Admin / Batch Director only. A student was shown a blank page there; the backend was already limited to their own record.
- **Print escaping:** `printReport` and the printable marksheets now HTML-escape every value. Names can come from public forms, and the print window shares the app's origin.

## 13.7 Verification

| Check | Result |
|---|---|
| Frontend typecheck, backend `tsc --noEmit`, `vite build` | Pass |
| Lint | 3 errors, all pre-existing in untouched files (`ui/command.tsx`, `ui/textarea.tsx`, `tailwind.config.ts`); the `StudentVideos` error is fixed |
| Rules + service checks (database-free: pure rules plus the service over in-memory fake models) | **80/80 pass**. Covered: overall / absent / invalid rows; bands; trend windows (including 4–5 exams); every at-risk rule including "single low mark never flags"; configurable thresholds; course / session / batch / reg-no / name / subject / date / attendance / status filters; pagination, sort, export; Director restrictions (own batches only, 403 on another batch or student, scoped options and charts); student / no-permission 403; student `/me` without at-risk labels; empty data → null averages; source records unchanged |
| Browser flow tests (Playwright, mocked API) | **54/54 pass**. Covered: analytics cards and charts; at-risk card filter; dependent course → batch; exam filter gating; server pagination; drill-down and its links; Excel export; at-risk print; empty state; rules panel; Director own-batch options and blocked admin route; student blocked from staff URLs and never calling staff endpoints; grouped student nav; dashboard `/me` summary without risk labels; results, subject filter, marksheet tab and print; attendance calendar and list; payments and receipts; materials; notices; videos empty state; mess; profile dirty / cancel / save gating; settings rules validation and cancel |
| Previous release's flow tests (v1.5) | 47/47 pass |
| Responsive sweep (15 pages × 320 / 375 / 414 / 768 / 1024 / 1440 / 1920) | No horizontal overflow, no page errors (see §13.8) |

## 13.8 Limitations / production verification

- **🔵 No live MongoDB run.** The aggregation pipelines (`$group`/`$push`, `$lookup`, `$substrBytes`) were not run against a real database here. The emulated logic around them passed. Please open the analytics page and a few student portals on staging before go-live.
- **Deploy backend and frontend together.** The student Results and Attendance pages read `/analytics/performance/me`. An older backend shows their error state, though nothing crashes.
- **Cache scope.** The cache lives in each server instance. On multi-instance hosting, another instance can show figures up to 60 s old; **রিফ্রেশ** recomputes.
- **Video classes** are still stored in the browser (pre-existing `AcademicContext` mock store), so students usually see "no videos". This was left as it was.
- **Current batch only.** Analytics counts active students in their *current* batch and the exams of the selected batches. Results from a previous batch appear in that student's profile and drill-down, but not in batch-level aggregates.
- **No PDF export of the analytics list.** jsPDF has no Bengali font, so Excel and print are offered instead.
