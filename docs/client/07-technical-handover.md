# Document 07 — Technical Handover

For whoever operates, deploys, or continues developing this system next. Everything here was confirmed against the current repository, not against a plan or spec document.

## 7.1 Repository Layout

```
LaraLMS/
├── src/            # Frontend (React 18 + Vite + TypeScript, Tailwind CSS)
├── backend/        # Backend (Node.js + Express + TypeScript, Mongoose/MongoDB)
└── docs/client/    # This handover package
```

The frontend and backend are two independent Node projects with their own `package.json`, `node_modules`, and build step — there is no shared build tool or monorepo tooling (no Turborepo/Nx/workspaces) tying them together.

## 7.2 Build & Run Commands

**Frontend** (from the repository root):

```
npm install
npm run dev      # local development server (Vite)
npm run build    # production build -> dist/
npm run lint     # ESLint
npm run test     # Vitest
```

**Backend** (from `backend/`):

```
npm install
npm run dev        # local development server (ts-node-dev, auto-restart)
npm run build      # compiles TypeScript -> dist/
npm run start      # runs the compiled dist/server.js (production)
npm run typecheck  # tsc --noEmit
npm run seed       # one-time: creates the first (Super Admin) login — see 7.4
```

Both `tsc --noEmit`, `eslint`, and `vite build` were run as part of the production-readiness audit and passed with zero errors at the time of this handover.

## 7.3 Environment Variables (Backend)

All required/optional variables and their defaults are declared and validated (via `zod`) in `backend/src/config/env.ts`. A template with every variable is at `backend/.env.example` — **never commit a real `.env` file**; `.gitignore` already excludes it.

| Variable | Required? | Purpose |
|---|---|---|
| `MONGO_URI` | **Required, no default** | MongoDB connection string. |
| `JWT_ACCESS_SECRET` | **Required, no default** | Signs short-lived Admin access tokens. |
| `JWT_REFRESH_SECRET` | **Required, no default** | Signs the Admin refresh-cookie token. |
| `JWT_ACCESS_EXPIRES_IN` | Optional (default `15m`) | Admin access token lifetime. |
| `JWT_REFRESH_EXPIRES_IN` | Optional (default `30d`) | Admin refresh-cookie lifetime. |
| `PORTAL_ACCESS_EXPIRES_IN` | Optional (default `12h`) | Student/Staff Portal token lifetime (no refresh). |
| `CORS_ORIGIN` | Optional (default `http://localhost:5173`, **dev only**) | Must be set to the real frontend origin in production. |
| `BCRYPT_SALT_ROUNDS` | Optional (default `12`) | Password hashing cost. |
| `ADMIN_SEED_PHONE` / `ADMIN_SEED_PASSWORD` / `ADMIN_SEED_NAME` | Optional (defaults `01700000000` / `ChangeMe123!` / `Admin`) | Only used by `npm run seed`. **The default password must be changed immediately after first login** — see §7.6 and Document 08. |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Optional | Image/logo uploads, if used. |
| `SMS_API_KEY` / `SMS_SENDER_ID` / `SMS_API_URL` / `SMS_SIGNATURE` | Optional | Guardian result SMS and student-credential SMS. Leaving these blank disables SMS sending (the system logs and skips instead of failing). |

**Frontend:** `VITE_API_URL` (optional) — points the frontend at the backend's API base URL. Defaults to `http://localhost:5000/api/v1` for local development only; **must be set to the real production API URL when building for deployment.**

## 7.4 First-Time Setup (Seeding the Super Admin)

Run `npm run seed` once, from `backend/`, against a fresh database. This creates the first Admin account — the **Super Admin** — using `ADMIN_SEED_PHONE` / `ADMIN_SEED_PASSWORD` / `ADMIN_SEED_NAME` (or their defaults if those env vars are not set).

> As of v1.1, this seeded account is marked `mustChangePassword = true`, so the very first login is required to set a new password via the app's own forced Change Password screen before anything else can be done. **Do this immediately, before the production instance is reachable by anyone else** — see Document 08's checklist.

## 7.5 Authentication & Session Model (technical detail)

- **Admin**: `identifier` (phone) + `password`, bcrypt-compared server-side. Issues a short-lived JWT access token plus an httpOnly refresh cookie (rotated via `/auth/refresh`).
- **Batch Director / Staff Portal**: `phone` + `staffId`, a pure lookup against the Staff collection — no password, no stored session record. Access token only, no refresh; the frontend persists it to `localStorage` so a page reload doesn't log the user out mid-session.
- **Student Portal**: `phone` + `currentRollNumber`, same no-password lookup pattern as Staff.
- **RBAC**: permission keys use a `module:action` convention (e.g. `payments:create`). Admin gets the wildcard `"*"`; Batch Director/Student get a fixed, hardcoded default set (`backend/src/modules/rbac/permissions.ts`). An Admin's wildcard can be narrowed via `User.deniedPermissions` (the per-Admin module picker in Staff Management). Every permission check is enforced in Express middleware (`requirePermission`/`requireRole`/`requireSelf`) on the server — the frontend's own checks are for UI/UX only and are never the real security boundary.
- **Account lockout**: after a configured number of failed login attempts (`MAX_FAILED_LOGIN_ATTEMPTS`, in `backend/src/config/constants.ts`), an Admin account is automatically locked and must be unlocked by another Admin.
- **Forced password change**: `User.mustChangePassword` — set for the seeded Super Admin and for any account whose password was reset/created without an explicit value. Enforced at the frontend routing layer (`src/components/ProtectedRoute.tsx`) as of v1.1.

## 7.6 Security Posture (as audited)

- `helmet()` and CORS (from `CORS_ORIGIN`) are applied globally; request body size is capped at 2mb.
- No secrets are committed to the repository — confirmed by a full-repository scan; only `.env.example` files are tracked, and `.gitignore` correctly excludes real `.env` files.
- Auth endpoints (`/login`, `/student-login`, `/staff-login`, `/refresh`) are rate-limited; public marksheet/info endpoints are separately rate-limited.
- Production error responses never leak internal error details or stack traces (`backend/src/common/middlewares/errorHandler.middleware.ts`); everything is still logged server-side with a request ID for debugging.
- `Payment.studentId` is deliberately **not unique** — a student can have any number of legitimate payments. `Payment.receiptNo` is unique and immutable. A client-supplied `idempotencyKey` is uniquely indexed (partial index) to prevent duplicate-submission payments without restricting how many real payments a student can make.
- Database indexes were reviewed across all models (Student, Payment, Staff, Course, Subject, Lecture, Material, Enrollment, Exam, Result, Attendance, AdmissionResult, RefreshToken). All were found to be intentional and appropriately scoped; none were changed during this audit.

## 7.7 What's Missing for a Fully Automated Deployment

No Dockerfile, docker-compose, or CI/CD pipeline exists in this repository today. A production deployment currently means, manually:

1. Provision a MongoDB instance (Atlas or self-hosted) and set `MONGO_URI`.
2. Set all required/production env vars on both frontend (`VITE_API_URL`) and backend (`MONGO_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGIN`, and any SMS/Cloudinary credentials in use).
3. `cd backend && npm install && npm run build && npm run start` (or run it under a process manager such as PM2/systemd).
4. `npm install && npm run build` at the repository root, and serve the resulting `dist/` as static files (e.g. behind Nginx or a CDN), pointed at the backend's real URL via `VITE_API_URL` at build time.
5. Run `npm run seed` (backend) once against the fresh production database, then log in and immediately change the Super Admin password (forced automatically as of v1.1).

Packaging this into Docker/CI is listed as a suggested future improvement in Document 02 §2.4, not part of the current delivery.
