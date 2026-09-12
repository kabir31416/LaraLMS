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

Implemented so far:

- **Authentication, User Management, Role & Permission** (Modules 1–3)
- **Settings** (Module 5) — `Settings` + `PublicInfoSettings` singletons
- **Session, Course, Subject, Lecture** (Modules 6–9) — academic master data,
  each with a delete guard against orphaning the level below it
- **Student, Admission, Batch** (Modules 10–12) — Guardian as its own
  collection, quick admission + full admission in one form, admin-only Roll
  Number (`PATCH /students/:id/roll`), and `BatchEnrollment` for transfer
  history (`POST /students/:id/enroll|transfer|withdraw`,
  `GET /batches/:id/roster`) — see Phase 1 §13/§14

**Dashboard (Module 4)** is deliberately built last among this group — it
aggregates Students/Batches/Attendance/Payments, none of which exist as
backend modules yet, so a real implementation now would just be stub
numbers. It's picked back up once those modules land.

Remaining modules are tracked in the session's task list and added to
`src/modules/` and `src/routes/index.ts` one at a time, each wired into the
existing React frontend (`AcademicContext`, `AuthContext`, ...) and tested
before the next begins.

## Conventions

- One folder per module under `src/modules/<name>/`: `*.model.ts` (Mongoose
  schema), `*.validation.ts` (zod), `*.service.ts` (business rules — this is
  where audit logging happens), `*.controller.ts` (thin HTTP glue),
  `*.routes.ts` (auth + RBAC + validation middleware wiring).
- Every response is `{ success, data?, error?, meta? }` (see
  `common/utils/apiResponse.ts` / `errorHandler.middleware.ts`).
- `requireAuth` → `requirePermission(...)` → `validate(schema)` → controller,
  in that order, on every protected route.
