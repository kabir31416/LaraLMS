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

Implemented so far: **Authentication, User Management, Role & Permission**
(Modules 1–3). Remaining modules are tracked in the session's task list and
added to `src/modules/` and `src/routes/index.ts` one at a time, each wired
into the existing React frontend and tested before the next begins.

## Conventions

- One folder per module under `src/modules/<name>/`: `*.model.ts` (Mongoose
  schema), `*.validation.ts` (zod), `*.service.ts` (business rules — this is
  where audit logging happens), `*.controller.ts` (thin HTTP glue),
  `*.routes.ts` (auth + RBAC + validation middleware wiring).
- Every response is `{ success, data?, error?, meta? }` (see
  `common/utils/apiResponse.ts` / `errorHandler.middleware.ts`).
- `requireAuth` → `requirePermission(...)` → `validate(schema)` → controller,
  in that order, on every protected route.
