# LaraLMS Backend

Express + TypeScript + MongoDB/Mongoose + JWT backend for the LaraLMS
Coaching Management ERP, implemented module-by-module per the approved
Phase 1/2 architecture review.

## Setup

```bash
cd backend
npm install
cp .env.example .env   # then fill in MONGO_URI and the JWT secrets at minimum
npm run seed            # creates the admin/batch_director/student roles + one Admin user
npm run dev              # http://localhost:5000
```

Health check: `GET /health`. All API routes are mounted under `/api/v1`.

## Status

All 27 planned modules are implemented and wired into the React frontend,
with one explicit exception:

- **Authentication, User Management, Role & Permission** (Modules 1–3)
- **Dashboard** (Module 4) — admin/director aggregate stats
- **Settings** (Module 5) — `Settings` + `PublicInfoSettings` singletons
- **Session, Course, Subject, Lecture** (Modules 6–9) — academic master data,
  each with a delete guard against orphaning the level below it
- **Student, Admission, Batch** (Modules 10–12) — Guardian as its own
  collection, quick admission + full admission in one form, admin-only Roll
  Number (`PATCH /students/:id/roll`), and `BatchEnrollment` for transfer
  history (`POST /students/:id/enroll|transfer|withdraw`,
  `GET /batches/:id/roster`) — see Phase 1 §13/§14
- **Staff, Batch Director** (Modules 13–14)
- **Fees, Payment, Receipt** (Modules 15–17) — payments auto-post into the
  Accounts ledger server-side, idempotently (unique partial index on
  `IncomeEntry{source, refId}`)
- **Attendance, Offline Result, Exam** (Modules 18–20)
- ~~**Video Class**~~ (Module 21) — **skipped**, not implemented
- **Book Management** (Module 22) — inventory, branch stock, student issues
- **Branch, Branch Ledger** (Modules 23–24) — unifies what used to be two
  separate mock branch lists (Book's and Accounts') into one collection
- **Notice** (Module 25)
- **Report Center** (Module 26) — no backend changes needed; every report
  page already consumed real-API-backed contexts from earlier modules
- **Student Portal + Public `/info`** (Module 27) — `GET /students/me`
  denormalizes a student's own batch/director onto their profile (the one
  call the Student role is authorized to make, since it holds none of the
  broad list-read permissions the admin/director screens use); `GET
  /public/students` is a no-login, rate-limited search endpoint driven by
  the admin-configurable `PublicInfoSettings` (enabled flag, per-method
  toggles, and a hard field allow-list — never exposes a Mongo `_id`)

## Conventions

- One folder per module under `src/modules/<name>/`: `*.model.ts` (Mongoose
  schema), `*.validation.ts` (zod), `*.service.ts` (business rules — this is
  where audit logging happens), `*.controller.ts` (thin HTTP glue),
  `*.routes.ts` (auth + RBAC + validation middleware wiring).
- Every response is `{ success, data?, error?, meta? }` (see
  `common/utils/apiResponse.ts` / `errorHandler.middleware.ts`).
- `requireAuth` → `requirePermission(...)` → `validate(schema)` → controller,
  in that order, on every protected route.
