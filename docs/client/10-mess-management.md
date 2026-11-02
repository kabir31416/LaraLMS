# Document 10 — Mess / Hostel Management

Mess / Hostel Management for coaching students who already exist in the LaraLMS Student Database.

> **Charges at a glance**
>
> | Charge | When | In the monthly bill? |
> |---|---|---|
> | **Monthly seat rent** (মাসিক ভাড়া) | Every month, from the joining month | **Yes — the monthly bill is seat rent only** (plus any other charge/fine added to it) |
> | **Dining charge** (ডাইনিং চার্জ) | **Once**, at admission | No |
> | **One-month advance** (এক মাসের অগ্রিম) | Once, at admission; held for the student | No — settled at check-out (dues are taken from it, the rest is refunded) | This document describes what is built in the code. The **Verification status** section at the end says exactly what was tested and how.

> **Meal Management is not part of this release.** There is no meal entry, meal count, meal rate or meal billing. Bills hold typed line items (`rent`, `setup`, `additional`, `late_fee`), so a future `meal` item can be added without changing how dues are calculated.

## 10.1 Overview

| Area | What it does |
|---|---|
| Mess / Hostel setup | Several Mess locations, each with an auto-generated code (`MESS-001`), address, contact, opening date, notes, Active/Inactive status, and assigned staff (Manager / Accountant / Caretaker / Support). |
| Rooms & seats | Rooms (number, floor, type, capacity, facilities, status) and seats (number, type, monthly rent, "available from", status). Seat statuses: Available, Reserved, Occupied, Maintenance, Inactive. Includes seat history and an available-seat search. |
| Members | Existing students only (no duplicate student records). Workflow: application, review, approval, activation, on-leave / notice, seat transfer, leaving. Membership history is kept. |
| Reservations | Hold a seat until an expiry date, with an optional advance payment that carries into the membership. |
| Admission charges | One-time **Dining Charge** + **One-Month Advance**, Amount Paid, method and Remaining Due, on one receipt. Neither is ever part of a monthly bill. |
| Billing | **Monthly seat-rent bills generated automatically by the server on the billing day (default the 1st, Bangladesh time)**, plus manual monthly, individual, per-Mess or bulk generation using the same code. Generation is idempotent and dues carry forward. Configurable joining-month rent rule. Bills can be adjusted or cancelled, and each has a printable invoice. |
| Payments | Monthly rent, dues, the dining charge and the advance, with receipts (billing month, previous due, remaining due), cancellation/reversal, verification and duplicate-submit protection. Mess payments are kept separate from Course Fee collections. |
| Joining-date correction | Preview of the effect on bills before saving, optional re-issue of affected bills, an adjustment record and an audit entry. Own permission. |
| Mess SMS | Payment, monthly bill, due reminder, admission and check-out SMS to the student's phone, each with its own switch and editable template, duplicate prevention, test SMS and history. |
| Security deposit & settlement | Deposit deductions, use of the deposit against dues, refund approval and payout, final leaving settlement, and a settlement print. |
| Expenses | Mess-specific expenses in categories, with approval, attachments, and category, date and Mess-wise totals. |
| Complaints & maintenance | Students submit complaints from the portal and staff open maintenance tickets. Both have assignment, status history and linked expenses. |
| Notices | Notices for a whole Mess or one member, with publish/expiry dates, read status and optional SMS. |
| Student Portal | **মেস / হোস্টেল** page: current Mess, room and seat, joining date, monthly rent, one-time dining charge, one-month advance, current rent bill (previous due, remaining due), payments and receipts, notices, complaints and history. |
| Reports | Occupancy, member list, available seats, admission/check-out, collection (dining vs advance/deposit, by date/month/method/Mess), month-wise bills vs collection, dues, **previous due**, advances, deposits, expenses, income vs expense / Mess-wise balance, refunds, and **Mess SMS history**. All are filtered on the server, and the ERP's existing print, PDF and Excel toolbar is reused. |
| Mess Settings | Billing day, due day, grace period, auto monthly billing switch, default monthly rent, default one-time dining charge and default one-month advance, receipt and bill prefixes, late fee, joining-month rent rule, approval switches, allowed payment methods, the five SMS switches and templates with test SMS, and lists of room types, seat types and expense/complaint/maintenance categories. Each Mess can override the rent, dining charge, advance, billing day and due day. |

## 10.2 Where it lives

- **Admin:** sidebar → **মেস / হোস্টেল** (`/mess`). Each Mess page has its own section tabs: Dashboard, Mess & Rooms/Seats, Members & Admission, Billing, Payments, Deposit & Settlement, Expenses, Complaints, Notices, Reports and Mess Settings. The Mess selector at the top limits every page to one Mess or shows all.
- **Mess staff:** log in through the existing **Staff Portal** (mobile number + Staff ID). They see only the Mess sections their role allows, and only for the Messes they are assigned to.
- **Students:** Student Portal → **মেস / হোস্টেল** (`/student/mess`).
- **Printing:** `/mess/payments/:id/receipt`, `/mess/bills/:id/invoice` and `/mess/settlements/:id/print`. The institution name, logo, address, signature label and paper size come from the central Institution Settings.

## 10.3 Student membership workflow

1. **Search an existing student** by name, Registration No., System ID, student phone, guardian phone or course. Students whose admission is still pending or was rejected cannot be selected. A student who already has an open Mess membership is shown but cannot be picked.
2. **Choose a Mess, then an available seat.** Only Available seats in active rooms of active Messes are offered.
3. **Set the terms:** joining date, expected leaving date, monthly seat rent (seat's rent → this Mess's default → Mess Settings default), monthly discount, emergency contact, an optional document and notes.
4. **Choose the initial state:**
   - **Pending application** — no seat is held yet.
   - **Approved** — the seat becomes *Reserved*.
   - **Active** — the seat becomes *Occupied* and the initial charges are taken now.

   Approved and Active need the "approve members" permission.
5. **Admission charges** (Active now, or later when an Approved member is activated):

   | Field | Meaning |
   |---|---|
   | Dining Charge (one-time) | Charged **once**. Default from this Mess, else Mess Settings; editable. Not part of any monthly bill. Payments settle it before any rent bill. |
   | One-Month Advance | Default: this Mess's / Mess Settings' value, else one month's rent; editable. Held for the student (never income) and settled at check-out. |
   | Total payable at admission | Dining Charge + Advance. Monthly rent is **not** included. |
   | Amount Paid, Payment Method, Reference | One receipt (type "ভর্তি"). Applied to the dining charge first, then the advance. Anything beyond both is a credit against rent. Partial payment is allowed. |
   | Remaining Due | Total payable at admission − Amount Paid. |

   When the member becomes Active, the **joining month's rent bill** is also created (by the joining-month rent rule), plus any later month already past if the joining date is in the past. This is normal monthly rent billing, not part of the admission payment.

   If the payment step fails, the membership and seat still stand and the operator finishes it from the profile (**ভর্তির চার্জ ও পেমেন্ট**).
6. **Lifecycle after that:**

   ```
   Pending → Approved → Active ⇄ On Leave ⇄ Notice Given → (Check-out / Final Settlement) → Checked-out ("চেক-আউট")
   Pending → Cancelled (rejected)
   ```

   Pending, Approved, or Active with no money attached can also be Cancelled.
7. **Seat transfer** moves a seat-holding member to another available seat, in the same or another accessible Mess. The rent can change at the same time. Seat history records both seats with their dates.

8. **Joining-date correction** (profile → **যোগদানের তারিখ সংশোধন**, or the member list's row menu; permission `mess:members:edit-dates`):
   - Choosing a new date first shows a **preview**: which bills would be cancelled, re-issued with a new amount, created for a missing month, or left unchanged, and the net change.
   - Nothing is rewritten silently. Bills change only if the operator ticks "adjust these bills". Affected bills are then cancelled with the reason and re-issued under the new date (other charges on them are carried over). Payments are never edited; the ledger re-allocates them.
   - The date change, its reason and every bill effect are stored in the member's **তারিখ সংশোধন** history (the adjustment record) and in the AuditLog.
   - Not allowed after a check-out settlement has been approved.

**Rules enforced by the backend:**

- One open membership per student, enforced by a unique database index as well as a pre-check.
- One holder per seat, enforced the same way.
- Every seat hand-over is a single conditional update, so two operators cannot give the same seat to two students.
- Old memberships are never deleted. The real joining and leaving dates are stored.
- The student's Course, Batch, Results, Attendance and tuition fees are never touched.

**Reservations:** a seat can be reserved until an expiry date, and advance money taken against the reservation gets a receipt. Converting the reservation into a membership moves the seat and the advance to the member; conversion must use Approved or Active. Overdue reservations are expired automatically whenever reservations, seats or the dashboard are loaded. There is also a manual **"মেয়াদোত্তীর্ণ রিজার্ভেশন বাতিল করুন"** button, so no scheduler is needed.

## 10.4 Billing and payment workflow

**Bill formula** (one rent bill per member per month):

```
Monthly Seat Rent (+ one-time setup charge, if any) + Other Charges / Fine (+ Late Fee, if enabled)
 − Discount − Approved Adjustment                       = Current Charge
 + Previous Due (earlier rent bills; or − earlier over-payment)
                                                        = Total Payable
Total Payable − Total Paid                              = Remaining Due   (status Paid / Partial / Due)
```

The one-time dining charge and the one-month advance never appear on a monthly bill. Each bill stores the monthly rent, other charges, previous due, total payable, total paid, remaining due, status and generated date, plus how it was made (automatic, manual, admission or re-issue).

**Automatic monthly billing (mandatory, server-side):**

- On each active Mess's billing day (that Mess's own day, else Mess Settings, default **the 1st**), the backend generates the month's bill for every Active, On Leave and Notice Given member. "Today" is computed in `APP_TIMEZONE` (default **Asia/Dhaka**), so the 1st starts at 00:00 Bangladesh time, not UTC.
- It does not depend on anyone opening a page. Two runners call the same sweep:
  - the long-lived server (`server.ts`) checks every 30 minutes (and 15 seconds after start-up);
  - on Vercel, a Vercel Cron Job calls `GET /api/v1/mess/cron/monthly-billing` daily at 00:05 Bangladesh time (`5 18 * * *` UTC, see `backend/vercel.json`), authenticated with `Authorization: Bearer <CRON_SECRET>`. Without `CRON_SECRET` the route refuses every call.
- **Once per month:** each Mess's month is claimed atomically before generating, so a retry, a second server instance or both runners firing together cannot double-bill. Bill creation is idempotent underneath that as well.
- **Catch-up:** if the server was down on the billing day, the first run later in the same month bills it.
- If a run fails (for example the database is unreachable) the claim is released and the next run retries. Members that fail individually are listed in the run summary; the Mess Dashboard shows "X/Y Messes billed, N bills, F failed", and **বিল তৈরি** on the Billing page fills only the gaps, using the same code.
- Each automatic run is audit-logged (`mess.bill.auto-generate`, `mess.scheduler.run`).
- Switch: Mess Settings → **স্বয়ংক্রিয় মাসিক বিল** (on by default).

**Joining-month rent rule** (Mess Settings, applies to future bills only):

| Rule | Joining month after the 1st |
|---|---|
| Full monthly rent (default) | Full rent |
| Pro-rated | Rent × remaining days ÷ days in month |
| Next month | No rent for the joining month; rent starts on the 1st of next month |

**One-month advance:** held until check-out. At check-out the final settlement takes any outstanding rent/dining due (and approved damage charges) from it and refunds the rest. An operator can still apply it to dues earlier by hand (**অগ্রিম সমন্বয় / ফেরত** → apply to dues, choosing the month).

- **Generation:** you can bill one member from their profile, or bill every eligible member for a month for one Mess or all Messes. Active, On Leave and Notice Given members are billed. Before you confirm, a preview shows how many members are eligible, how many already have a bill, and how many bills will be created.
- **Idempotent:** a unique `(membership, month)` index makes it impossible to create a second live bill for the same member and month, even if two generation runs overlap. Re-running a month only creates the missing bills.
- **Correction:** cancel the bill with a reason, then generate that month again. Use **Adjust** for an approved one-off credit. A cancelled bill that carried the setup charge releases it to the corrected bill.
- **Late fee** is **off by default.** When it is on, a flat fee is added to the next bill if an earlier bill is still unpaid after its due date plus the grace period.
- **Payments:**
  - A payment is recorded against the member, not against one bill. Partial payments, multiple payments and advance payments are all supported, and money is applied to the oldest unpaid bill first.
  - Anything paid beyond what is owed is held as an advance.
  - Each payment form submission sends a single-use key, so a double-click or network retry returns the same payment instead of creating a second one.
  - The operator can choose the **billing month** the payment is for. The receipt shows it with the **previous due** (before this payment) and the **remaining due**, advance credit and advance/deposit balance after it.
  - The one admission receipt shows how much went to the dining charge and how much to the advance. Every collection total uses those two parts, so the same taka is never counted on both sides.
- **Cancellation/reversal** is a soft flag with a reason. The receipt stays on record, marked as cancelled, and balances are recalculated without it. Payments cannot be hard-deleted.
- **Verification:** a finance approver can mark payments as verified, for example after checking a bKash/Nagad TrxID.
- **Payment methods** come from the existing **Settings → Payment Methods** master data. Mess Settings can limit which of them are used for the Mess.
- **Kept separate from course fees:** Mess money is stored in its own collection (`messpayments`), not in the tuition `payments` collection. Fee Management, the Dashboard's fee collection, the Fee Collection report and student tuition dues are unaffected.

## 10.5 Expense workflow

1. Add an expense: Mess, date, category, amount, payment method, description, paid by, vendor/recipient, invoice number, and an optional attachment (image or PDF up to 5 MB).
2. If **Expense approval** is on (the default), an expense entered by someone who is not an approver is *Pending* until an approver approves or rejects it. Approvers' own entries are approved immediately.
3. Pending expenses can be edited. Approved expenses can only be edited by an approver. Expenses are cancelled rather than deleted.
4. Only **approved** expenses count in reports and in income vs expense.
5. A maintenance ticket can have expenses linked to it. The ticket only references the expense, so the money is counted once.

## 10.6 Security deposit and final settlement

- **Collecting:** normally on the admission receipt (see §10.3). Later top-ups use **Payment → type "অগ্রিম / জামানত".** The amount cannot exceed the remaining required deposit. A deposit is money held on the student's behalf and is **never counted as income.**
- **Movements out of the deposit:**
  - **Deduction** — damage or other approved charges kept by the Mess.
  - **Apply to dues** — the deposit is used to clear rent dues.
  - **Refund** — money paid back to the student.

  An approver's request takes effect immediately. Anyone else's request is Pending until approved. A refund also has to be marked as paid out (method, date and reference) before it counts.
- **Check-out / final settlement** (from the member profile or the member list: **"চেক-আউট — চূড়ান্ত হিসাব"**). The screen shows outstanding due, advance/deposit balance, refundable amount, the part adjusted against dues, and the final amount (refund, or still owed):

  ```
  One-Month Advance + Over-payment Credit − Outstanding Due (rent + dining charge) − Approved Damage/Other Charges = Refundable Amount
  ```

  The deposit first covers whatever is owed. The rest of the deposit is refunded, and any advance beyond what is owed is refunded too. If the result is negative, the student still owes that amount: it stays on their account as due after they leave and can still be collected.
- **Stages:** Pending, Approved, Completed.
  - All figures are recalculated on the server at approval and again at completion.
  - While a settlement is approved, new payments and new bills for that member are blocked.
  - Completing it posts the deposit movements, ends the membership as **Left** with the leaving date, frees the seat, and closes the seat history.
  - A completion that is retried or double-submitted cannot apply the deposit twice.
  - The settlement can be printed.

## 10.7 Roles and permissions

Mess Management uses the existing permission system: the same `requirePermission` checks and permission catalogue, and the existing Staff records and Staff Portal login. **Hiding a menu item is never the only protection.** Every API call checks the permission, and every Mess query is also limited to the Messes the caller may see.

**Mess-level scope:**

- Admin (`*`) and anyone holding `mess:all-access` see every Mess.
- Mess staff see only the Messes whose staff list includes them. Admin assigns them under **Mess & Rooms/Seats → Staff**.
- Students see only their own Mess data. The portal reads the student from the login token, never from anything the browser sends.

**New Staff types** (Staff → add staff) log in through the Staff Portal:

| Capability | Admin | Mess Manager | Mess Accountant | Mess Caretaker | Student |
|---|---|---|---|---|---|
| View assigned Mess(es), rooms, seats, members | ✓ all | ✓ assigned | ✓ assigned | ✓ assigned | own only |
| Create/edit Mess, rooms, seats, assign staff | ✓ | — | — | — | — |
| Admission, reservation, transfer, status | ✓ | ✓ | — | — | — |
| Approve/activate members | ✓ | ✓ | — | — | — |
| Correct joining date (may re-issue bills) | ✓ | ✓ | — | — | — |
| Generate/adjust/cancel bills | ✓ | ✓ | ✓ | — | — |
| Receive payments, deposit requests | ✓ | ✓ | ✓ | — | — |
| Cancel (reverse) payments | ✓ | — | — | — | — |
| Financial approvals (refunds, deposit movements, settlement approval/completion, payment verification; discounts and adjustments when that switch is on) | ✓ | — | — | — | — |
| Expenses (add) | ✓ | ✓ | ✓ | — | — |
| Expenses (approve) | ✓ | — | — | — | — |
| Complaints & maintenance | ✓ | ✓ | — | ✓ | submit own |
| Notices | ✓ | ✓ | — | — | read own |
| Mess reports, Mess SMS history | ✓ | ✓ | ✓ | — | — |
| Send due-reminder SMS now | ✓ | ✓ | ✓ | — | — |
| Mess Settings, SMS templates, test SMS | ✓ | — | — | — | — |
| **Permanently delete** any Mess record | **Super Admin only** | — | — | — | — |

- **"Support Staff"** are ordinary *Staff*-type records assigned to a Mess. They are listed as staff but have no Mess login.
- **Per-Admin restriction:** the existing per-Admin module picker in StaffForm now includes **মেস / হোস্টেল**. Unticking it removes every Mess permission from that Admin.
- **Inactive Mess staff:** a Mess staff member whose Staff record is নিষ্ক্রিয় cannot log in to the portal. Batch Director login behaviour is unchanged.

**Permission keys added:**

- `mess:view`, `mess:manage`, `mess:all-access`
- `mess:members:manage`, `mess:members:approve`, `mess:members:edit-dates` (joining-date correction)
- `mess:billing:manage`, `mess:payments:collect`, `mess:payments:cancel`, `mess:finance:approve`
- `mess:expenses:manage`, `mess:expenses:approve`
- `mess:complaints:manage`, `mess:notices:manage`, `mess:reports:read`, `mess:settings:manage`
- `mess:read:own` (students)

**Super Admin permanent delete.** Only the Super Admin (the seeded root Admin, `User.isSuperAdmin`) sees a red **স্থায়ীভাবে মুছুন** button on Messes, rooms, seats, members, reservations, bills, payments, advance movements, settlements, expenses, complaints and notices. Ordinary Admins and Mess staff keep the normal cancel/deactivate actions and are refused by the server if they call the delete API.

- The operator must type **DELETE**; the server also requires `confirm=DELETE` (`DELETE /api/v1/mess/admin/:type/:id?confirm=DELETE`).
- Before deleting, the full record (and, for cascades, how many related records went with it) is written to the AuditLog as `mess.<type>.permanent-delete`.
- What goes with it:
  - **Member**: all their bills, payments, advance movements and settlements; the seat is freed. The student's main record (course, tuition fees, results) is not touched.
  - **Mess**: everything in it — rooms, seats, members and their money records, reservations, expenses, complaints and notices.
  - **Room**: its seats. Refused while any seat is held by a member or reservation (move, check out or delete the member first). The same applies to a **seat**.
  - **Reservation**: its unconverted advance payments; an active reservation frees its seat.
  - **Settlement**: its advance movements; a checked-out member stays checked out.
- Every affected member's balance is recalculated from what remains. Deleted receipt/bill numbers are not reused.

## 10.8 Reports

| Report | Source |
|---|---|
| Occupancy (Mess and room) | Server aggregate of seat statuses |
| Mess-wise / room-wise member list, membership history | Members list with filters: status (including full history), course, batch, search |
| Available seats | Seat list, available seats in active rooms only |
| Admission / check-out | Memberships by joining date or check-out date in a date range |
| Collection | Dining-charge and advance/deposit parts of every receipt, by date, month, method and Mess |
| Month-wise bills vs collection | Last 6/12/24 months: bills, billed amount, advance adjusted, paid/due on those bills, money received that month |
| Previous due | Members with unpaid bills from earlier months: oldest month, months unpaid, previous due, this month's due, total |
| Mess SMS history | Every Mess SMS with event, number, text, provider status (accepted / failed / no answer) and, for Alpha SMS, an on-demand delivery check. Filter by status, event and date. |
| Student-wise bill | Billing list filtered by month, status and student |
| Dues / advances / security deposits | Cached member balances, sorted, with totals |
| Expenses | Approved expenses grouped by category, date and Mess |
| Income vs expense / Mess-wise balance | Rent collected + deposit deductions − advance refunds, compared with approved expenses. Also shows current dues, deposits held and advances. |
| Refunds | Deposit refunds and advance refunds from settlements |

- **Filters:** date range, Mess, room, student, Registration No., course, batch, status, and payment method (on the payment list and the collection report).
- **Export:** the existing print, PDF and Excel toolbar. Paginated reports export the rows currently loaded.

## 10.9 Settings

**Mess Settings** (`/mess/settings`, Admin only) is its own singleton collection. It holds:

- Default Mess
- Billing day, due day and grace period; automatic monthly billing on/off
- Default monthly seat rent, default one-time dining charge and default one-month advance (0 = one month's rent)
- Receipt prefix and bill prefix
- Late fee (on/off and amount)
- Joining-month rent rule (§10.4)
- Approval switches for discounts, refunds and expenses
- Which payment methods the Mess may use
- Mess SMS: a switch per event (payment, monthly bill, due reminder, admission, check-out), an editable template per event, and a test SMS
- Lists of room types, seat types, and expense, complaint and maintenance categories

**Per-Mess defaults** (Mess & Rooms/Seats → edit a Mess): monthly rent, dining charge, advance, billing day and due day. Left blank, the Mess Settings value applies.

Every settings change applies to future admissions, bills and SMS only — nothing already issued is recalculated — and is written to the AuditLog with before/after values.

**Mess SMS:**

- Sent to the **student's own phone** (`Student.phone`) through the existing SMS module, so the active provider (BulkSMSBD or Alpha SMS) and its API key stay in the central SMS Settings. No key is ever sent to the browser.
- Template placeholders: `{{studentName}}`, `{{messName}}`, `{{amount}}`, `{{paymentDate}}`, `{{receiptNo}}`, `{{billingMonth}}`, `{{previousDue}}`, `{{remainingDue}}`, `{{paymentMethod}}`, `{{dueDate}}`, `{{totalPayable}}`. A template with any other placeholder is rejected on save.
- **Status is only what the provider answered.** "Accepted" means the gateway took the SMS; handset delivery is a separate status, available on demand for Alpha SMS from the SMS history. Nothing is shown as sent without a provider response; a request with no answer is "no response", not "failed".
- **An SMS can never fail or undo a payment, bill, admission or check-out** — it is sent after the record is saved and errors are only logged.
- **No duplicates:** each SMS carries a key (e.g. `payment:<id>`, `bill:<id>`, `due:<member>:<month>`); a retry finds the earlier accepted SMS and does not send again. Due reminders go out automatically once per member per month on the due day (when switched on), or on demand from the Billing page (once per member per day).
- Bulk sends (monthly bills, due reminders) use the shared `SMS_BULK_CONCURRENCY` limit.
- Failed and unanswered SMS from the last 30 days are counted on the Mess Dashboard.

Two things are fixed and cannot be edited, because the workflow logic depends on them: **membership statuses** and **notice types**. Currency is BDT and the billing cycle is monthly.

## 10.10 Data model

New collections:

| Collection | Purpose |
|---|---|
| `messes` | Mess profile and assigned staff |
| `messrooms` | Rooms |
| `messseats` | Seats |
| `messmemberships` | Memberships. Seat history and status history are embedded, and cached ledger balances are stored here. |
| `messreservations` | Seat reservations |
| `messbills` | Bills, with line items embedded (no separate bill-items collection) |
| `messpayments` | Money received for the Mess |
| `messdeposittransactions` | Deposit deductions, applications to dues, and refunds |
| `messsettlements` | Final leaving settlements |
| `messexpenses` | Mess expenses |
| `messcomplaints` | Complaints and maintenance tickets together |
| `messnotices` | Mess notices |
| `messsettings` | Mess Settings |

**Fields added in this update** (all optional or defaulted — existing records keep working, nothing is migrated or deleted):

- `messes`: `defaultDiningCharge`, `defaultDeposit`, `billingDay`, `dueDay`, `autoBilledPeriod`, `autoBillingLastRun`, `dueReminderPeriod`
- `messes`: also `defaultRent`
- `messmemberships`: `diningCharge` (one-time), `initialPaymentId`, `dateHistory[]`, `balance.diningDue`
- `messbills`: `source`
- `messpayments`: purpose `initial`, `allocation {rent, deposit}`, `billingMonth`, `dueBefore`. Older payments have no `allocation`; their purpose decides the split.
- `messdeposittransactions`: `period`
- `messcomplaints`: `resolutionNote`, `cost`
- `messsettings`: `prorationMode`, `defaultDiningCharge`, `autoBillingEnabled`, `billSmsEnabled`, `dueReminderSmsEnabled`, `admissionSmsEnabled`, `checkoutSmsEnabled`, `smsTemplates`
- `smslogs` (shared SMS log): `messId`, `refType`, `refId`, `dedupeKey`, `deliveryStatus`, `deliveryCheckedAt`, plus two partial indexes

**Reused, not duplicated:**

- Students, Guardians and Staff
- The Counter-based number generator, used for Mess codes and bill, receipt and ticket numbers
- PaymentMethod master data
- Institution Settings for branding
- The AuditLog collection: every Mess change is written with module `mess` and a before/after snapshot
- The SMS service (`sendSms`), with a new log category `mess`
- The Cloudinary upload service, extended with a generic attachment upload

**No transactions assumed.** Consistency comes from:

- Partial unique indexes: open membership per student, seat holder, live bill per month, payment idempotency key, and settlement movements
- Atomic conditional updates for every state change
- A ledger that is always recalculated from the source documents, never adjusted by running +/− totals. Writes are sequenced, so an older recalculation can never overwrite a newer one.

**Hard deletes are blocked** for everyone except the Super Admin (see §10.7). Others deactivate or cancel instead.

## 10.11 Known limitations

- **Requires live verification.** The Mess module has not yet been exercised end-to-end against a running MongoDB. See §10.13 for what was and was not tested. Run the §10.13 checklist on a **test database** before going live.
- **Accounts ledger.** Mess money is not copied into the coaching Accounts / Branch Ledger, on purpose, so that coaching income stays clean. Mess income vs expense is reported inside the Mess module.
- **Reservation expiry** happens when reservations, seats or the dashboard are loaded, or from the manual button (the new scheduler handles monthly bills and due reminders only).
- **Automatic billing needs a runner.** On a long-lived server it starts with the process. On Vercel it needs the cron entry in `backend/vercel.json` and `CRON_SECRET` set in the project's environment; without `CRON_SECRET` the cron route refuses to run. Vercel's free plan runs crons once a day, which is enough because each run catches up within the month. A month in which no run happened at all (server down the whole month) is not back-filled automatically — use **বিল তৈরি** for it.
- **Bills re-issued by a joining-date correction** carry a "previous due" snapshot taken at re-issue time, not at the original issue date. Balances and paid/due figures are always recomputed correctly.
- **Payment billing month** is a label for the receipt and reports. Money is still applied to the oldest unpaid bill first.
- **Attachments** go to Cloudinary only when Cloudinary is configured. PDF delivery may need "Allow delivery of PDF" switched on in the Cloudinary account. An uploaded file is not deleted if its form is abandoned.
- **SMS:**
  - Notice SMS is sent while the operator waits, with limited parallel sends. Very large Messes take longer.
  - Payment, admission and check-out SMS are sent in the background after the response, like tuition payment SMS. On serverless hosting one may not finish; it then shows as "pending/no response" in the SMS history and is never shown as sent. The scheduler's bill and due-reminder SMS are awaited.
  - Delivery reports exist only for Alpha SMS. BulkSMSBD shows provider acceptance only.
- **Billing cycle** is monthly only. The late fee is a flat amount per bill.
- **Student search by Mess staff.** To admit students, Mess Managers can search the whole student list. Only basic fields are returned: name, IDs, phone, course, batch and guardian phone.
- **Staff Portal tokens** carry a fixed permission set per Mess role, the same design as Batch Director. Per-person fine-tuning of a Mess staff login is not available.
- **Exports** of paginated reports cover the loaded page (up to 100 rows). The PDF export uses the existing exporter, which may not render Bengali glyphs. Use Print for Bengali output.
- **Meal Management** is not included (see the top of this document).

## 10.12 Future scope — Meal Management (not implemented)

- Meal entry per member per day
- Daily meal count
- Monthly meal rate (total bazar cost ÷ total meals)
- A `meal` line item on the monthly bill

These would sit on the existing ledger. Bazar costs would come from Mess expenses, and the meal charge would become one more bill item.

## 10.13 Verification status

**Update (monthly auto billing, admission charges, joining-date correction, Mess SMS, Super Admin delete) — actually executed:**

- `tsc --noEmit` for backend and frontend: no errors.
- `eslint`: backend 0 errors. Frontend: no new errors (only the same 3 errors in untouched files).
- `vite build`: succeeds.
- The original 42-check script: still all passing.
- A second script, **51 checks, all passing** (re-run after the charge-model correction):
  - Joining-month seat rent in all three rules, including 28/29-day February; bill lines labelled as seat rent.
  - The monthly bill formula (rent + other − discount + previous due; no dining charge, no advance) and rounding.
  - The one-time dining charge: counted only once the member is admitted, and settled before any rent bill.
  - The admission split (dining charge first, then the advance, never counted twice), including partial and over-payment.
  - The aggregation expressions that split receipts into rent/dining vs advance, evaluated against legacy and new payment rows.
  - Check-out: the advance covers dues and the rest is refunded.
  - The 1st-of-month decision in Asia/Dhaka: 30 Nov 18:30 UTC is already 1 Dec in Dhaka; once per month; catch-up after downtime; billing-day clamping; local day boundaries.
  - Joining-date helpers, SMS templates, and the new permission's role defaults.
  - 18 HTTP checks against the real Express app, including: the cron route fails closed; permission refusals on the new endpoints; **permanent delete refused for an ordinary Admin and a Mess Manager, and for a Super Admin without `confirm=DELETE` or with an unknown record type**; invalid dining charges, rules, billing months and billing days rejected.
- Headless Chromium render of the production build with a **mocked API** at 320, 375, 414, 768, 1024, 1366 and 1920 px: Mess Dashboard, admission dialog, members list, member profile, joining-date dialog, billing, settings, the monthly / previous-due / collection / SMS reports, complaints, the Student Portal page and the main dashboard. No horizontal overflow and no runtime errors.

**Update — not executed:** any database-backed flow (no MongoDB in this sandbox), a real scheduler run on the 1st, and a real SMS send. Add these to the test-database checklist below.

**First release — actually executed (in the development sandbox):**

- `tsc --noEmit` — backend and frontend: no errors.
- `eslint` — backend: 0 errors, only the 3 warnings that were already there. Frontend: only the 3 errors that were already there, in `ui/command.tsx`, `ui/textarea.tsx` and `student/StudentVideos.tsx`, all untouched files.
- `vite build` — frontend: succeeds.
- A verification script, 42 checks, all passing:
  - Settlement formula in all branches
  - Oldest-first payment allocation for partial and advance payments, and rounding
  - Membership status → index flags
  - Date and period helpers
  - The permission catalogue (no Mess staff role has cross-Mess, settings, cancel or approval powers; Batch Director gained nothing; students get only `mess:read:own`)
  - 28 HTTP checks of authentication, role-based access and input validation against the real Express app

**Not executed:**

- Any database-backed flow. The sandbox has no MongoDB, and running a local MongoDB-compatible test server was not permitted in this environment. This covers: creating a Mess, rooms and seats; admission; duplicate-membership and occupied-seat rejection; transfer; bill generation and re-generation; payments; deposits and settlement; expenses; Mess-scope isolation between two Mess Managers; the Student Portal; dashboards and reports.
- Browser / mobile-layout testing.

**Run this on a test database before production:**

1. Create two Messes, rooms and seats.
2. Admit an existing student.
3. Try to admit the same student again — it must be rejected.
4. Try to admit a different student to an occupied seat — it must be rejected.
5. Transfer the member to another seat.
6. Generate this month's bills, then generate them again — no duplicates.
7. Take two partial payments for one student and an over-payment (advance).
8. Double-click "Confirm payment" — only one payment.
9. Check the receipt and invoice figures.
10. Collect a deposit, request a deduction and a refund, and approve them.
11. Add an expense and approve it.
12. Run a final settlement and check the refundable amount.
13. Log in as a Mess Manager assigned to Mess A and confirm Mess B is invisible, including by direct API call.
14. Log in as a student and see only your own Mess data.
15. Confirm the tuition Fee Management totals are unchanged.
16. Check the dashboard and reports.
17. Check pages on a phone-width screen.
18. **Admission charges:** admit a student on the 16th with a dining charge, one-month advance and a partial payment. Check: one receipt with its dining/advance split, Remaining Due, that no monthly bill contains the dining charge or advance, that the joining month's rent bill follows the rent rule, and that the advance appears once in collection totals.
19. **Monthly auto billing:** set a test Mess's billing day to today (or set the server clock / wait for the 1st), start the server, and confirm every active member gets exactly one bill. Restart the server and call `GET /api/v1/mess/cron/monthly-billing` with the `CRON_SECRET` — no second bill. Check the Mess Dashboard's auto-billing line and the AuditLog.
20. **Joining-month rent rules:** repeat 18 with Full, Pro-rated and Next-month and check the rent bill.
21. **One-month advance at check-out:** check out a member with a rent due; the settlement takes the due from the advance and refunds the rest.
22. **Joining-date correction:** move a joining date earlier and later. Check the preview, the re-issued bills (only when ticked), the date-change history, and the AuditLog. Confirm a Mess Accountant gets "permission denied".
23. **Payment SMS:** with the payment SMS switch on, take a payment; the student's phone receives it and the SMS history shows the provider status. Take the same payment twice by double-clicking — one payment, one SMS.
24. **SMS failure:** with a wrong SMS API key, take a payment — the payment succeeds and the SMS shows as failed.
25. **Test SMS** from Mess Settings, and the due-reminder button on Billing (send twice the same day — no duplicates).
26. **Previous due, month-wise and SMS reports:** check figures against the bills and payments lists.
27. **Super Admin delete:** as Super Admin, delete a payment, a bill and a member — balances recalculate and the AuditLog has each record. As an ordinary Admin, confirm no delete button appears and the API returns 403.
