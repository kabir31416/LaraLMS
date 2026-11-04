# 14. Public Pages, Material Management, Student List Filters & Support Card (v1.7)

This release has four parts:

- a redesign of the four public pages;
- a complete add → stock → distribute → history workflow for Material Management;
- server-side "smart" filters on the Student List;
- a fixed developer/support card on the Student Portal profile.

Every page uses the existing APIs and models. There are no new collections, and no calculation, search, validation or submission rule has changed.

## 14.1 Public pages

All four pages share one layout, `src/components/public/PublicShell.tsx`. It has:

- a sticky header with the institution logo and name;
- navigation to তথ্য অনুসন্ধান, মার্কশিট and তথ্য পূরণ, plus a লগইন link;
- a hero with an icon, title and description;
- the content card and a footer.

The pages use the blue / white / soft blue-gray theme, Lucide icons and the Hind Siliguri font. They have loading (skeleton/spinner), empty, success and error states, and they were checked at 320–1920 px.

| Page | What changed | Unchanged |
|---|---|---|
| `/info` | Three action cards (search, marksheet, student entry), each with a "যা লাগবে" list, a privacy note and a link to the student portal. | Routes. |
| `/info/search` | Large search field. Bengali digits are converted to ASCII. Inline field error, skeleton, empty and initial states. Result cards show the photo, roll, course, batch, director, average % and attendance % meters. | `GET /public/students?method=phone&q=`, the 2-character minimum, the rate limit and the fields the server returns. |
| `/marksheet` | Individual / batch tabs (`?type=batch`). Date range with presets (this month, last 3 months, this year). Inline validation. Individual result has summary tiles, per-subject bars and a details table (a list on phones). Batch view has a top-3 podium, an in-sheet name/roll search and sticky roll/name columns. | `GET /public/results/individual`, `/batches`, `/batch-master-sheet`, and the grade, percentage and rank calculations (done on the server). |
| `/studententry` | Verify step with inline errors. Edit step has a completeness meter, identity/photo card, sticky section navigation, per-section cards, a highlight on missing required fields with scroll-to-first, a sticky save bar, an unsaved-changes guard and confirmation before "অন্য শিক্ষার্থী". | `POST /verify`, `GET/PATCH /profile`, `POST /photo`, the required-field list, the rule that a pending application needs a photo, and the save payload. |

**Print / PDF.** The marksheet's Print and PDF actions now open the same styled, HTML-escaped print document (A4; the batch sheet is landscape). The PDF button shows a "Save as PDF" hint. The old jsPDF export could not render Bengali text, so it produced garbled PDFs.

## 14.2 Material Management (`/books`)

**Dashboard.** Four summary cards from `GET /materials/dashboard/stats`:

- **Total Materials**
- **Available Stock**
- **Distributed:** an all-time total, plus this month and today
- **Low Stock:** includes the out-of-stock count

There are also panels for "needs attention" (low or out of stock), most distributed and recent distributions. The selected tab is kept in the URL (`?tab=`).

**Materials tab:**

- Search, plus filters for course, type, stock (available / low / out), free or paid, and status. The default status filter is active.
- Sorting and 15 rows per page; a table on desktop and cards on phones.
- A stock indicator (OK / Low / Out) on every row.
- Row menu actions: view details (with the latest recipients), distribute, edit, add stock, adjust stock (the dialog shows the resulting stock and blocks a negative result), stock history, activate or deactivate, and delete.
- **Delete** is allowed only for a material that has never been distributed. Otherwise the server answers 409 and the UI suggests deactivating instead. Deleting also removes that material's stock movements, and the action is audited (`material.delete`).

**Distribution tab — single student.** This flow is unchanged:

- duplicate check (allow / warn / block, from Settings);
- optional payment collection;
- confirmation, which now lists every item.

It now also honors the *block* rule on the client, and it reloads materials afterwards so the stock figures are fresh.

**Distribution tab — whole batch (new).**

1. Choose the batch and the materials, with a quantity per student. Out-of-stock materials cannot be selected.
2. The server preview (`POST /materials/distributions/bulk` with `dryRun: true`) shows:
   - active students, recipients, and how many already received the material and are skipped;
   - for each material, needed vs. available;
   - any shortages and the value of paid materials.
3. If any material is short, the Distribute button stays disabled. The confirmation shows each material's stock before and after.
4. Confirming calls the same endpoint without `dryRun`. The server repeats every check.

**Server guarantees (`material.service.ts`).**

- Stock is deducted with an atomic conditional update: `currentStock ≥ quantity`, and the material must be active. Two simultaneous distributions therefore cannot oversell.
- If writing the distribution records fails, the deducted stock is restored and any partly written rows are removed. The system has no Mongo transactions, so it uses compensating steps instead.
- Recipients are the batch's active, approved students; pending and rejected applications are excluded. The limit is 500 per request.
- Records already received are loaded in one query, so there is no N+1.
- A bulk distribution writes one distribution record per student and one stock movement per material, and is audited as `material.distribute-bulk`.
- Permission: `materials:distribute`.

**History.** Search, plus filters for batch, material, status and date range. It is paginated, shows cards on phones, and supports reversal with a reason.

## 14.3 Student List smart filters (`/students`)

The panel has:

- **Search:** name, registration number, roll, id, or the student's or guardian's mobile. Typing is debounced.
- **Sort:** roll (default), name, newest or oldest admission, or highest due first.
- **Quick filters:** Course and Batch (batches are limited to the chosen course; "ব্যাচ নির্ধারিত হয়নি" is also available), Student Status, and Due Status.
- **"আরও ফিল্টার"** (collapsible, with a badge showing the number of active filters):
  - Admission Date range
  - Birthday (today, or any month)
  - HSC Institution (a searchable dropdown)
  - Gender, Fee Type, Profile (complete / incomplete) and Application (pending approval)
  - Division, District and Guardian Mobile
- **Active filters** appear as removable chips. "সব ফিল্টার মুছুন" resets everything except the sort.
- **Matching count:** "N জন শিক্ষার্থী মিলেছে".

Filters apply immediately; text fields wait 350 ms after typing stops, so no Apply button is needed. All filters, the sort and the page number are stored in the URL. They survive pagination, reloads and back/forward navigation, and the URL can be shared. Changing any filter returns to page 1.

All filtering happens on the server. **Print** and **Export** send exactly the same query (`GET /students/export`), including the sort, so their output matches the screen.

**Backend support added** (`student.validation.ts` / `student.service.ts`). These are the only new parameters; every other filter already existed:

| Parameter | Matches |
|---|---|
| `status` | `সক্রিয়` / `নিষ্ক্রিয়` |
| `admissionDateFrom` / `admissionDateTo` | `yyyy-mm-dd`, inclusive. Admission dates are stored as `yyyy-mm-dd` strings, so a string range is exact. |
| `birthMonth` | 1–12. Matches `dob` of the form `yyyy-MM-dd`. `birthdayToday` takes precedence. |

All three are validated with zod; an invalid value returns 400. An explicit sort now has an `_id` tie-break so pages never overlap. Export follows the explicit sort; without one it keeps roll order. Permissions are unchanged (`students:read`). Rejected applications stay hidden unless asked for, as before.

## 14.4 Student Profile — Support card

At the very bottom of `/student/profile` there is a support card (`src/components/student/SupportCard.tsx`). It reads:

> **Need Help or Technical Support?** For technical assistance or system-related support, contact: **Sahariar Kabir**, Software Engineer, WhatsApp: **01999667701**

The **WhatsApp-এ যোগাযোগ** button opens `https://wa.me/8801999667701` in a new tab with `rel="noopener noreferrer"`.

The details are constants in the source code. They are not stored in the database or in settings and there is no input field, so students cannot change them. The card is responsive, and the button's dark WhatsApp green gives readable contrast with white text.

## 14.5 Security

- No new public endpoint. The new bulk-distribution and delete routes require `materials:distribute` and `materials:deactivate`; Student List parameters run behind the existing `students:read`.
- Public pages show only what the existing public endpoints already return.
- Print documents escape every value.
- No secrets in the frontend.

## 14.6 Verification

| Check | Result |
|---|---|
| Frontend `tsc` (app), ESLint on the changed files (warnings only, no errors), production build | ✅ |
| Backend `tsc --noEmit` | ✅ |
| Materials service, run without a database against in-memory fake models: single and bulk stock arithmetic, oversell guard, rollback when a write fails, duplicate rules, skip-received, delete rules, dashboard totals | ✅ 32/32 |
| Student filters, run without a database: validation, status, admission range, birth month, `birthdayToday` precedence, the list count matches the list filter, stable sort and paging, export uses the same filter and sort | ✅ 13/13 |
| Browser flows (Playwright, mocked API) for public pages, the material workflow, combined Student List filters, chips, sort, pagination, reload, print and export, and the Support card | ✅ 53/53 |
| No horizontal overflow at 320 / 375 / 414 / 768 / 1024 / 1440 / 1920 px on the 9 affected screens | ✅ 9/9 |
| Regression suites from earlier releases (v5 analytics and portal; v4 login, dashboards, staff, settings) | ✅ 54/54, 47/47 |

🔵 **Requires verification on a real database:**

- concurrent bulk distributions;
- the date-range and birth-month filters against production data formats;
- printing in the target browsers.

## 14.7 Limitations

- Batch distribution records the value of paid materials but does not collect payment. Collect it from Fee Management, or use single-student distribution, which can take payment.
- At most 500 students per bulk request, and at most 2000 rows per Student List print or export (existing cap).
- Admission-date and birthday filters rely on dates stored as `yyyy-mm-dd`, which is how the app writes them. Records imported in another format will not match.
- The Support card is on the Student Portal profile only, not the Admin view of a student.
