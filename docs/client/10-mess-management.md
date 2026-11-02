# Document 10 — Mess / Hostel Management

Mess / Hostel Management for coaching students who already exist in the LaraLMS Student Database. This document describes what is built in the code. The **Verification status** section at the end says exactly what was tested and how.

> **Meal Management is not part of this release.** There is no meal entry, meal count, meal rate or meal billing. Bills hold typed line items (`rent`, `setup`, `additional`, `late_fee`), so a future `meal` item can be added without changing how dues are calculated.

## 10.1 Overview

| Area | What it does |
|---|---|
| Mess / Hostel setup | Several Mess locations, each with an auto-generated code (`MESS-001`), address, contact, opening date, notes, Active/Inactive status, and assigned staff (Manager / Accountant / Caretaker / Support). |
| Rooms & seats | Rooms (number, floor, type, capacity, facilities, status) and seats (number, type, monthly rent, "available from", status). Seat statuses: Available, Reserved, Occupied, Maintenance, Inactive. Includes seat history and an available-seat search. |
| Members | Existing students only (no duplicate student records). Workflow: application, review, approval, activation, on-leave / notice, seat transfer, leaving. Membership history is kept. |
| Reservations | Hold a seat until an expiry date, with an optional advance payment that carries into the membership. |
| Billing | Monthly, individual, per-Mess or bulk bill generation. Generation is idempotent and dues carry forward. Bills can be adjusted or cancelled, and each has a printable invoice. |
| Payments | Rent, dues, advance and security deposit, with receipts, cancellation/reversal, verification and duplicate-submit protection. Mess payments are kept separate from Course Fee collections. |
| Security deposit & settlement | Deposit deductions, use of the deposit against dues, refund approval and payout, final leaving settlement, and a settlement print. |
| Expenses | Mess-specific expenses in categories, with approval, attachments, and category, date and Mess-wise totals. |
| Complaints & maintenance | Students submit complaints from the portal and staff open maintenance tickets. Both have assignment, status history and linked expenses. |
| Notices | Notices for a whole Mess or one member, with publish/expiry dates, read status and optional SMS. |
| Student Portal | **মেস / হোস্টেল** page: current Mess, room and seat, rent, current bill, paid, due, payments and receipts, deposit, notices, complaints and history. |
| Reports | Occupancy, member list, available seats, joining/leaving, rent collection, dues, advances, deposits, expenses, income vs expense / Mess-wise balance, and refunds. All are filtered on the server, and the ERP's existing print, PDF and Excel toolbar is reused. |
| Mess Settings | Billing day, due day, grace period, default rent and deposit, receipt and bill prefixes, late fee and proration (both off by default), approval switches, allowed payment methods, payment SMS, and lists of room types, seat types and expense/complaint/maintenance categories. |

## 10.2 Where it lives

- **Admin:** sidebar → **মেস / হোস্টেল** (`/mess`). Each Mess page has its own section tabs: Dashboard, Mess & Rooms/Seats, Members & Admission, Billing, Payments, Deposit & Settlement, Expenses, Complaints, Notices, Reports and Mess Settings. The Mess selector at the top limits every page to one Mess or shows all.
- **Mess staff:** log in through the existing **Staff Portal** (mobile number + Staff ID). They see only the Mess sections their role allows, and only for the Messes they are assigned to.
- **Students:** Student Portal → **মেস / হোস্টেল** (`/student/mess`).
- **Printing:** `/mess/payments/:id/receipt`, `/mess/bills/:id/invoice` and `/mess/settlements/:id/print`. The institution name, logo, address, signature label and paper size come from the central Institution Settings.

## 10.3 Student membership workflow

1. **Search an existing student** by name, Registration No., System ID, student phone, guardian phone or course. Students whose admission is still pending or was rejected cannot be selected. A student who already has an open Mess membership is shown but cannot be picked.
2. **Choose a Mess, then an available seat.** Only Available seats in active rooms of active Messes are offered.
3. **Set the terms:** joining date, billing start date, expected leaving date, monthly rent (defaults to the seat's rent), monthly discount, security deposit (defaults from Mess Settings), one-time setup charge, emergency contact, an optional document and notes.
4. **Choose the initial state:**
   - **Pending application** — no seat is held yet.
   - **Approved** — the seat becomes *Reserved*.
   - **Active** — the seat becomes *Occupied* and billing can start.

   Approved and Active need the "approve members" permission.
5. **Lifecycle after that:**

   ```
   Pending → Approved → Active ⇄ On Leave ⇄ Notice Given → (Final Settlement) → Left
   Pending → Cancelled (rejected)
   ```

   Pending, Approved, or Active with no money attached can also be Cancelled.
6. **Seat transfer** moves a seat-holding member to another available seat, in the same or another accessible Mess. The rent can change at the same time. Seat history records both seats with their dates.

**Rules enforced by the backend:**

- One open membership per student, enforced by a unique database index as well as a pre-check.
- One holder per seat, enforced the same way.
- Every seat hand-over is a single conditional update, so two operators cannot give the same seat to two students.
- Old memberships are never deleted. The real joining and leaving dates are stored.
- The student's Course, Batch, Results, Attendance and tuition fees are never touched.

**Reservations:** a seat can be reserved until an expiry date, and advance money taken against the reservation gets a receipt. Converting the reservation into a membership moves the seat and the advance to the member; conversion must use Approved or Active. Overdue reservations are expired automatically whenever reservations, seats or the dashboard are loaded. There is also a manual **"মেয়াদোত্তীর্ণ রিজার্ভেশন বাতিল করুন"** button, so no scheduler is needed.

## 10.4 Billing and payment workflow

**Bill formula** (one bill per member per month):

```
Monthly Rent (+ one-time setup charge on the first bill) + Additional Charges (+ Late Fee, if enabled)
 − Discount − Approved Adjustment                       = This month's charges
 + Previous Due (or − previous advance)                 = Total Payable
Total Payable − Total Paid                              = Current Due
```

- **Generation:** you can bill one member from their profile, or bill every eligible member for a month for one Mess or all Messes. Active, On Leave and Notice Given members are billed. Before you confirm, a preview shows how many members are eligible, how many already have a bill, and how many bills will be created.
- **Idempotent:** a unique `(membership, month)` index makes it impossible to create a second live bill for the same member and month, even if two generation runs overlap. Re-running a month only creates the missing bills.
- **Correction:** cancel the bill with a reason, then generate that month again. Use **Adjust** for an approved one-off credit. A cancelled bill that carried the setup charge releases it to the corrected bill.
- **Late fee and proration** are **off by default.** When proration is on and billing starts mid-month, the first bill charges rent for the remaining days only. When the late fee is on, a flat fee is added to the next bill if an earlier bill is still unpaid after its due date plus the grace period.
- **Payments:**
  - A payment is recorded against the member, not against one bill. Partial payments, multiple payments and advance payments are all supported, and money is applied to the oldest unpaid bill first.
  - Anything paid beyond what is owed is held as an advance.
  - Each payment form submission sends a single-use key, so a double-click or network retry returns the same payment instead of creating a second one.
  - Every receipt shows the due, advance and deposit balance immediately after that payment.
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

- **Collecting:** use **Payment → type "জামানত" (deposit).** The amount cannot exceed the remaining required deposit. A deposit is money held on the student's behalf and is **never counted as income.**
- **Movements out of the deposit:**
  - **Deduction** — damage or other approved charges kept by the Mess.
  - **Apply to dues** — the deposit is used to clear rent dues.
  - **Refund** — money paid back to the student.

  An approver's request takes effect immediately. Anyone else's request is Pending until approved. A refund also has to be marked as paid out (method, date and reference) before it counts.
- **Final settlement** (from the member profile: **"ছেড়ে যাওয়া — চূড়ান্ত নিষ্পত্তি"**):

  ```
  Security Deposit + Advance Balance − Outstanding Due − Approved Damage/Other Charges = Refundable Amount
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
| Generate/adjust/cancel bills | ✓ | ✓ | ✓ | — | — |
| Receive payments, deposit requests | ✓ | ✓ | ✓ | — | — |
| Cancel (reverse) payments | ✓ | — | — | — | — |
| Financial approvals (refunds, deposit movements, settlement approval/completion, payment verification; discounts and adjustments when that switch is on) | ✓ | — | — | — | — |
| Expenses (add) | ✓ | ✓ | ✓ | — | — |
| Expenses (approve) | ✓ | — | — | — | — |
| Complaints & maintenance | ✓ | ✓ | — | ✓ | submit own |
| Notices | ✓ | ✓ | — | — | read own |
| Mess reports | ✓ | ✓ | ✓ | — | — |
| Mess Settings | ✓ | — | — | — | — |

- **"Support Staff"** are ordinary *Staff*-type records assigned to a Mess. They are listed as staff but have no Mess login.
- **Per-Admin restriction:** the existing per-Admin module picker in StaffForm now includes **মেস / হোস্টেল**. Unticking it removes every Mess permission from that Admin.
- **Inactive Mess staff:** a Mess staff member whose Staff record is নিষ্ক্রিয় cannot log in to the portal. Batch Director login behaviour is unchanged.

**Permission keys added:**

- `mess:view`, `mess:manage`, `mess:all-access`
- `mess:members:manage`, `mess:members:approve`
- `mess:billing:manage`, `mess:payments:collect`, `mess:payments:cancel`, `mess:finance:approve`
- `mess:expenses:manage`, `mess:expenses:approve`
- `mess:complaints:manage`, `mess:notices:manage`, `mess:reports:read`, `mess:settings:manage`
- `mess:read:own` (students)

## 10.8 Reports

| Report | Source |
|---|---|
| Occupancy (Mess and room) | Server aggregate of seat statuses |
| Mess-wise / room-wise member list, membership history | Members list with filters: status (including full history), course, batch, search |
| Available seats | Seat list, available seats in active rooms only |
| Joining / leaving | Memberships by joining date or leaving date in a date range |
| Monthly rent collection | Payments grouped by date, method and Mess. Deposit is shown separately. |
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
- Billing day, due day and grace period
- Default rent and default deposit
- Receipt prefix and bill prefix
- Late fee (on/off and amount)
- Proration (on/off)
- Approval switches for discounts, refunds and expenses
- Which payment methods the Mess may use
- Payment SMS (on/off)
- Lists of room types, seat types, and expense, complaint and maintenance categories

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

**Hard deletes are blocked** for any Mess, room or seat that has history. Deactivate it instead.

## 10.11 Known limitations

- **Requires live verification.** The Mess module has not yet been exercised end-to-end against a running MongoDB. See §10.13 for what was and was not tested. Run the §10.13 checklist on a **test database** before going live.
- **Accounts ledger.** Mess money is not copied into the coaching Accounts / Branch Ledger, on purpose, so that coaching income stays clean. Mess income vs expense is reported inside the Mess module.
- **Reservation expiry** happens when reservations, seats or the dashboard are loaded, or from the manual button. There is no background scheduler.
- **Attachments** go to Cloudinary only when Cloudinary is configured. PDF delivery may need "Allow delivery of PDF" switched on in the Cloudinary account. An uploaded file is not deleted if its form is abandoned.
- **SMS:**
  - Notice SMS is sent while the operator waits, with limited parallel sends. Very large Messes take longer.
  - The payment SMS is fire-and-forget, the same as tuition payment SMS. On serverless hosting it may not always finish.
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

**Actually executed (in the development sandbox):**

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
