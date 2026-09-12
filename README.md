# LaraLMS — Coaching Management ERP

A full-stack, Bengali-language ERP for running a coaching/tuition center:
admissions, batches, fees & payments, attendance, exams & results, book
inventory, branch accounting, notices, reports, a self-service student
portal, and a no-login public student-info search — with role-based access
for Admin, Batch Director, and Student.

The frontend is a React/TypeScript SPA; the backend is a real REST API
(Node.js/Express/TypeScript/MongoDB) that replaced the app's original
localStorage/mock-data prototype module by module.

## Tech stack

**Frontend** — `/` (root)
- React 18 + TypeScript + Vite
- React Router v6, TanStack Query
- Tailwind CSS + shadcn/ui (Radix UI primitives)
- react-hook-form + zod
- xlsx / jspdf + jspdf-autotable for Excel/PDF export, recharts for charts

**Backend** — `/backend`
- Node.js + Express + TypeScript
- MongoDB + Mongoose
- JWT auth (short-lived access token in memory + httpOnly refresh cookie)
- zod for request validation
- Role-based access control via permission-key strings (`module:action`)
- pino for structured logging, express-rate-limit for public endpoints

## Project structure

```
LaraLMS/
├── src/                      # React frontend
│   ├── pages/                 # One file per screen (Admin/Director/Student)
│   ├── pages/student/          # Student Portal screens
│   ├── contexts/               # One Context per feature, calling the real API
│   ├── components/              # Shared UI + shadcn/ui primitives
│   ├── lib/apiClient.ts          # Fetch wrapper: auth header, refresh-on-401, error envelope
│   ├── types/                     # Shared TS types per domain
│   └── routes.tsx                  # All app routes + role-based route guards
│
├── backend/
│   ├── src/modules/<name>/          # One folder per feature module:
│   │   │                              model.ts / validation.ts / service.ts /
│   │   │                              controller.ts / routes.ts
│   │   ├── auth, users, rbac            # Login, refresh, users, roles & permissions
│   │   ├── settings                      # Global settings + Public Info config
│   │   ├── academicSessions, courses,     # Academic master data
│   │   │   subjects, lectures
│   │   ├── students, guardians,            # Admissions, guardians, batch
│   │   │   batches, enrollments               enrollment/transfer/withdraw history
│   │   ├── staff                             # Staff + Batch Director assignment
│   │   ├── payments                           # Fees, payments, receipts
│   │   ├── attendance                          # Attendance (manual + exam-linked)
│   │   ├── exams                                # Offline exams + results
│   │   ├── books                                 # Book inventory, branch stock, issues
│   │   ├── branches, accounts                     # Branches + income/expense/ledger
│   │   ├── notices                                 # Notice board
│   │   └── publicInfo                               # No-login public search
│   ├── src/common/                    # ApiError, RBAC/auth middleware, pagination, etc.
│   └── src/routes/index.ts             # Mounts every module's router under /api/v1
│
└── README.md
```

## Feature modules

| Area | Status |
|---|---|
| Auth, Users, Roles & Permissions | ✅ |
| Dashboard (Admin/Director aggregates) | ✅ |
| Settings (incl. Public Info config) | ✅ |
| Academic Session / Course / Subject / Lecture | ✅ |
| Student, Admission, Batch, Enrollment history | ✅ |
| Staff, Batch Director | ✅ |
| Fees, Payments, Receipts | ✅ |
| Attendance, Offline Exams & Results | ✅ |
| Video Class (online MCQ class-exam system) | ⏭️ Skipped (not implemented) |
| Book Management (inventory, branch stock, issues) | ✅ |
| Branch & Branch Ledger | ✅ |
| Accounts (income/expense, auto-posted from payments) | ✅ |
| Notice Board | ✅ |
| Report Center (Admission/Fee/Due/Attendance/Result/Book/Staff/Ledger) | ✅ |
| Student Portal (self dashboard, attendance, results, payments, books, notices) | ✅ |
| Public `/info` — no-login student search | ✅ |

Every module above (except Video Class) is backed by a real MongoDB-persisted
REST API — no localStorage/mock data remains for those features.

## Getting started

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env     # fill in MONGO_URI and the JWT secrets at minimum
npm run seed               # creates Admin/Batch Director/Student roles + one Admin user
npm run dev                  # http://localhost:5000
```

Health check: `GET /health`. All API routes are mounted under `/api/v1`.

See [`backend/README.md`](backend/README.md) for backend-specific details,
conventions, and environment variables.

### 2. Frontend

```bash
npm install
npm run dev        # http://localhost:5173 (Vite dev server)
```

Set `VITE_API_URL` (e.g. in a `.env` at the project root) if the backend
isn't running at the default `http://localhost:5000/api/v1`.

### 3. Log in

Log in with the identifier/password from `ADMIN_SEED_PHONE`/
`ADMIN_SEED_PASSWORD` in `backend/.env` (set by you before running
`npm run seed`) — you'll be required to change the password on first login.

## Roles

- **Admin** — full access to every module.
- **Batch Director** — scoped to their assigned batch(es): students, results,
  attendance.
- **Student** — self-service portal: own profile, attendance, results,
  payments, book issues, and notices addressed to them.

Access control is enforced server-side via permission-key strings
(`module:action`, e.g. `students:read`), checked per-route — the frontend's
role-based routing is a UX convenience, not the security boundary.

## Scripts

**Frontend** (`package.json`): `dev`, `build`, `build:dev`, `lint`, `preview`, `test`, `test:watch`

**Backend** (`backend/package.json`): `dev`, `build`, `start`, `seed`, `typecheck`
