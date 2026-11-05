# 15. Student ID Cards & Exam / Admit Card Management (v1.8)

Two features, built on the existing Student, Course, Batch, Session, Subject, Guardian, Settings and authentication systems. There is no new student, course or batch model.

## 15.1 Identity fields (important)

| Printed label | Field | Meaning |
|---|---|---|
| **স্টুডেন্ট আইডি** (Student ID) | `Student.registrationId` (e.g. `LMS-01240`) | Permanent, system-generated, immutable |
| **রেজিস্ট্রেশন নম্বর** (registration no.) | `Student.currentRollNumber` | Academic registration number. The rest of the app already labels it "রেজিস্ট্রেশন নম্বর". |

Both cards print both values, each under its own label, and never swap them.

## 15.2 Data model

| Collection | Purpose | Why |
|---|---|---|
| `idcards` (`IdCard`) | One issuance record per student: `version`, a random `verifyCode` (the QR code), up to 10 `previousCodes`, a `fingerprint`, `firstIssuedAt`, `generatedAt`, `generatedBy`. | Needed for "issued / not issued / outdated" and the QR. It stores **no student data**: the card is always rendered from live records. `fingerprint` is a hash of the printed fields, so a change in name, photo, batch, phone and so on marks the card **outdated**. |
| `examschedules` (`ExamSchedule`) | Scheduled exam. Fields: `code` (EXM-YYYY-NNNN), name, type, course, optional batch, `allowCrossBatch`, session, subject, date, start/end time, duration, venue, instructions, status, `version`, `admitSeq`, publish/complete/cancel times and reason, creator/updater, timestamps. | This is deliberately **not** `OfflineExam`. `OfflineExam` is a result-entry record (one batch + subject + date + full marks, with `isPublished` controlling the public marksheet). Reusing it would change those meanings. |
| `examassignments` (`ExamAssignment`) | One row per (exam, student), enforced by a **unique index**. Holds the method (batch / student), the batch at assignment time, active/removed status, who did it and when, and the removal reason. The **admit card is embedded**: `cardNo` (unique), `verifyCode` (unique), the exam version, when and by whom it was generated, and a count. | Removing a student is a status change, so the history is kept and re-adding reactivates the same row. The batch is recorded at assignment time on purpose: batch-wise printing and director scoping stay stable if the student later moves batch. There is no separate admit-card collection and no copy of student data. |
| `cardsettings` (`CardSettings`) | Brand colour, ID layout (landscape / portrait), back side on/off, validity (course session / fixed date / none), rules, emergency contact on/off, QR on/off for each card, default exam instructions, admit cards per page (1 or 2). | The institution's name, logo, address, phone, email and website are **not** duplicated here; they still come from Institution Settings. |

## 15.3 APIs

**ID cards** (`/id-cards`):

- `GET /stats` returns total, issued, without card, outdated, issued today and the recent list.
- `GET /students` takes search, course, batch, card status and page.
- `POST /data` returns preview/print data. The selector is `{studentIds | batchId | courseId | all}`.
- `POST /generate` takes `{selector, mode: missing | changed | all}`.
- `GET /me` returns the student's own card.
- `GET` and `PATCH /settings`.

**Exams and admit cards** (`/exam-schedules`):

- `GET /overview`
- `GET /` (filters: search, course, batch, type, status, upcoming/past, date range)
- `POST /` to create
- `GET /:id` and `PATCH /:id`
- `POST /:id/status` to publish, unpublish, complete, cancel (a reason is required) or restore
- `DELETE /:id`
- `GET /:id/eligible`
- `GET /:id/assignments`
- `POST /:id/assignments` and `POST /:id/assignments/remove`
- `POST /:id/admit-cards/generate` with `{selector: all | batch | students, mode}`
- `POST /:id/admit-cards/data`
- Student endpoints: `GET /me` and `GET /me/:examId/admit-card`

**Public** (no login, rate-limited):

- `GET /public/verify/id-card/:code`
- `GET /public/verify/admit-card/:code`

## 15.4 ID card workflow (`/id-cards`)

1. **Choose who.** A batch, a course, students ticked in the table (one or many) or all eligible students. Eligible means active and approved; pending or rejected applications never get a card.
2. **প্রিভিউ.** A live, true-size preview of the front and back. Cards that haven't been issued yet are marked "PREVIEW" and have no QR code.
3. **ইস্যু করুন.** Pick one of three modes:
   - **New and changed** (default): issue missing cards and re-issue outdated ones.
   - **New only.**
   - **Re-issue all.** Gives a new version and a new QR code; the QR on any old printed card then shows "replaced".
4. **ইস্যু ও প্রিন্ট.** Issues new and changed cards first, then prints, so the paper always matches the record. Options:
   - **A4, front and back.** 10 landscape or 9 portrait CR80 cards per page, with dotted cutting lines and corner crop marks. The back page is mirrored for long-edge duplex.
   - **A4, front only.**
   - **Card size.** One 85.60 × 53.98 mm page per side, for PVC card printers.
   - **PDF.** The same document with a "Save as PDF" hint; the browser's PDF engine renders Bengali correctly.

**Card contents.**

- Front: institution logo and name, a "Student ID Card" band, photo, name, Student ID, registration number, course, batch, phone and blood group. Fields with no value are hidden. The footer shows validity (session end date or a fixed date) and the institution phone.
- Back: return-to address and contacts, rules, the emergency contact (guardian's mobile), the QR code and the signature line.
- Outdated cards are listed under the "তথ্য পরিবর্তিত" filter and counted on the overview cards.

**Design settings** ("ডিজাইন সেটিংস"): colour, layout, validity and the other options above, with a live preview.

## 15.5 Exam and admit card workflow (`/admit-cards`)

1. **Create the exam.**
   - Required: name, type, course and date.
   - Optional: batch, cross-batch permission, start/end time (duration is calculated automatically), venue, subject (only the course's subjects), session (defaults to the course's) and instructions (pre-filled from settings).
   - Save it as a draft, or save and publish.
2. **Assign students.** There are two ways:
   - **Batch-wise.** Choose a batch, and all eligible students are listed and pre-selected. Counters show *eligible / selected / excluded / already assigned*.
   - **Student-wise.** Search by name, Student ID, registration number or phone, and pick one or many.

   In both cases the server re-checks every student: active and approved, the same course, and the exam's batch unless "অন্য ব্যাচ অনুমোদিত" is on. Duplicates are refused, also under a double submit. Removing a student needs confirmation, accepts an optional reason, and keeps the history.
3. **Publish.**
4. **Generate admit cards.** For all assigned students, one batch, or ticked students. The modes are new and changed (default), missing only, or all.
   - Card numbers are `EXM-2026-0001-0001`. They are unique and allocated from an atomic per-exam counter, and are written only where no card exists, so parallel clicks never create two cards for one student.
   - Regenerating keeps the same number and QR code.
5. **Preview, print or PDF.**
   - One A4 card per page by default; two per page with a cut line is optional.
   - Each card shows the institution header, the ADMIT CARD / প্রবেশপত্র band, card number, exam name and type, student table and photo, date with weekday, start/end time, duration, venue, subject, session, numbered instructions, student signature, seal circle, authorised signature, and an optional QR code. Empty fields are hidden.
   - There is no app navigation in the print view.

**Editing a published exam.** If anything printed on the card changes (name, type, date, times, duration, venue, subject, session, instructions), the exam's `version` goes up. Generated cards then show as **outdated**, a banner offers "পুনরায় তৈরি করুন", and previews always show the current details. Student records are untouched. Course and batch can't change once students are assigned.

**Status rules.**

- Allowed changes: draft → published / cancelled; published → draft / completed / cancelled; completed → published; cancelled → draft.
- Completed and cancelled exams are read-only.
- **Delete** is only for mistakes: the exam must not be completed and must have no admit cards, and the exam code has to be typed to confirm. Otherwise, cancel instead.

## 15.6 Student Portal

- **আইডি কার্ড** (`/student/id-card`):
  - The student's own issued card, front and back, with print, card-size and PDF options.
  - If no card has been issued, it says so.
  - If their details changed after issue, they are told to get an updated card.
- **অ্যাডমিট কার্ড** (`/student/admit-cards`):
  - Their own assigned exams: published, completed and cancelled. Cancelled exams are marked cancelled and never show a card. **Drafts never appear.**
  - An admit card opens only once it has been generated, and can be printed or saved as PDF.

The student is always taken from the login token, never from the URL.

## 15.7 Permissions and security

| Permission | Who | Allows |
|---|---|---|
| `id-cards:manage` | Admin (`*`) | Everything for ID cards, including issuing and design settings |
| `id-cards:read:own-batch` | Batch Director | Preview and print ID cards of **their own batches' students**. Cannot issue or change settings. |
| `id-cards:read:own` | Student | Their own card only |
| `admit-cards:manage` | Admin (`*`) | Create, edit, assign, publish, generate, delete |
| `admit-cards:read:own-batch` | Batch Director | Read-only view of exams their batches' students sit; preview and print **their own batches'** admit cards |
| `admit-cards:read:own` | Student | Their own published, generated admit cards |

- Every rule is enforced on the server.
  - Route-level permission checks are combined with record scope inside each service. A director's batch list comes from `Batch.directorIds`.
  - A director asking for another batch gets 403. A student calling a staff endpoint gets 403. A student asking for an exam they aren't assigned to gets 404.
- Hiding a button is never the only protection.
- Two Admin menu modules ("আইডি কার্ড" and "পরীক্ষা ও অ্যাডমিট কার্ড") can be denied per Admin.
- Batch Directors who were already logged in get the new permissions at their next login.
- **QR codes** contain only a link with a random 128-bit code (`/verify/id/…`, `/verify/admit/…`), never personal data.
  - The verification page shows: valid / replaced / expired / inactive / cancelled / removed / not found.
  - It also shows name, Student ID, photo and course/batch, or the exam details for an admit card.
  - It never shows phone, guardian, address or blood group.
  - The endpoint is rate-limited.
- Every write is recorded in the audit log:
  - `id-card.generate`
  - `exam-schedule.create`, `update`, `published`, `completed`, `cancelled`, `delete`, `assign`, `unassign`
  - `admit-card.generate`
  - `settings.cards.update`

## 15.8 Verification

| Check | Result |
|---|---|
| Backend `tsc --noEmit`; frontend `tsc`, production build, ESLint | ✅ (2 lint errors remain, both in untouched shadcn `ui/` files) |
| Service tests without a database (83 checks): generation and idempotency, outdated detection and re-issue, QR states, eligibility, batch-locked vs cross-batch rules, duplicate and parallel double-submit, remove/reactivate, admit numbering under parallel bulk generation, regeneration keeping the number, edit locks, status transitions, delete rules, student visibility, director/student isolation, overview counts, audit trail | ✅ 83/83 |
| Browser flows against the **real** cards API (actual Express routes, validation, JWT auth and services over in-memory data, in Playwright): every scenario in the request, 1–17 | ✅ 93/93 |
| Print geometry measured in the print window: CR80 85.6 × 54.0 mm landscape and 53.98 × 85.6 mm portrait, A4 sheets, 16 cut-guided cells, mirrored backs, card-size pages, one or two admit cards per A4 page, no app UI | ✅ |
| No horizontal scrolling at 320, 375, 414, 768, 1024, 1440 and 1920 px on the ID cards page, the exam list, exam detail, the two student portal pages, the director ID cards page and the verify page | ✅ |
| Earlier suites (v1.7 pages and filters, v1.6 analytics and portal, v1.5 logins and dashboards) and the materials and student-filter service tests | ✅ 62, 54, 47; 32, 13 |

🔵 **Requires verification on a real MongoDB:**

- index builds (the unique (exam, student) index and the partial unique card-number and QR-code indexes);
- concurrent generation under real network timing;
- printing on the target printer at 100% scale with margins set to None.

## 15.9 Limitations

- At most 1000 students per generate, print or assign request.
- "Outdated" ID cards are worked out by comparing live data with the stored fingerprint, so the "outdated" filter and count read the issued cards in scope (fine for thousands of students).
- PDF is the browser's "Save as PDF" (a server-side PDF would need a Bengali font pipeline).
- Duplex alignment depends on the printer; use "front only" plus a separate back-page print if a printer shifts pages.
- QR links use the address of the site the card was printed from. Print from the production domain.
