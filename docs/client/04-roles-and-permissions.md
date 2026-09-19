# Document 04 — Roles & Permissions

Verified directly from the access-control code — not assumed.

## 4.1 Permission Matrix

LaraLMS ships with **three** built-in roles. 🔵 **Requires Verification**: Teacher/Staff/Accountant are recognised *staff types* (used for the Staff Portal, phone+Staff-ID login) but do not currently have their own distinct *permission role* in the system — a "Teacher" or "Staff" record today logs in only for identification/portal purposes and has no module-level permission set of its own beyond that. Confirm with the development team whether Accountant-specific access is expected as a future role.

| Module / Capability | Admin | Batch Director | Student |
|---|---|---|---|
| Everything (default) | ✓ all modules | — | — |
| View students | ✓ | ✓ own batch(es) only | ✓ own profile only |
| Admission / roll assignment | ✓ | ✓ own batch admission-roll only | — |
| Edit own profile fields | — | — | ✓ |
| Batches | ✓ manage all | ✓ view own only | — |
| Enrollments | ✓ manage | ✓ view own batch | — |
| Mark attendance | ✓ | ✓ own batch only | — |
| View attendance | ✓ | ✓ | ✓ own only |
| Enter/edit results | ✓ | ✓ own batch only | — |
| View results | ✓ | ✓ | ✓ own only |
| Payments / fees | ✓ create & view all | — | ✓ view own only |
| Staff management | ✓ | — | — |
| Materials/books | ✓ full management | — | ✓ view own distribution only |
| Accounts / Branch Ledger | ✓ | — | — |
| Notices | ✓ create/manage | ✓ read only | ✓ read only |
| Video classes | ✓ manage | — | ✓ read only |
| Reports | ✓ | — | — |
| Settings | ✓ | — | — |
| User/Staff account management | ✓ (Admin accounts: Super Admin only — see §4.3) | — | — |
| Change own password | ✓ | ✓ | *(N/A — Batch Director/Student portals don't use passwords; see Document 01 §1.5)* |

> **Custom roles.** The backend can technically store additional roles with any custom permission combination, but there is currently no screen to create one — see Document 02, §2.2.

## 4.2 The Admission Result Permission, In Detail

Admission Result is the one module with its own dedicated, individually switchable permission (separate from the blanket module picker described in §4.4), because it was the first feature built with this kind of fine-grained control.

- **How it's assigned** — toggled per-Admin at the moment that Admin is created or edited, by whoever holds the necessary access.
- **When enabled** — that Admin sees "Admission Result" in their sidebar and can use the PDF-import/matching workflow described in Document 03.
- **When disabled** — the sidebar item disappears for that Admin, and the underlying page/API also refuses them directly, even by typing the address in by hand.
- **Frontend protection** — the page itself checks this permission before rendering, so a restricted Admin is redirected away rather than shown a broken page.
- **Backend protection** — every API call this module makes independently re-checks the same permission; the frontend check is a courtesy, not the real gate.

## 4.3 Super Admin vs. Regular Admin

Every Admin can create staff and other Admins, run admissions, take payments, and use every module they've been given access to. The one thing a **regular** Admin cannot do — reserved for the original, first-created Admin account only — is edit another Admin's staff record, reset another Admin's password, or delete another Admin's account. This is enforced on the server, not just hidden in the interface.

## 4.4 Per-Admin Module Access

Beyond the fixed role, every individual Admin account can have specific modules switched off for them personally — Students, Fees, Staff, Batches, Materials, Accounts, Settings, Reports, and more — chosen from a checklist at the moment they're created or edited. This does not create a new role; it simply narrows what that one Admin's account can reach, on both the sidebar and the server.

## 4.5 Password Change & Forced Reset (added v1.1)

- **Voluntary change** — any authenticated Admin, Batch Director, or Student can open "Change Password" from the account menu in the Topbar at any time. This calls the backend's existing `/auth/change-password` endpoint, which requires the current password to be provided.
- **Forced change** — the backend flags an account with `mustChangePassword = true` in two cases: (1) the very first seeded Super Admin account, and (2) any login created or reset by the Super Admin without an explicit password being typed in. Any user in this state is shown a full-screen prompt and cannot access any other page until they set a new password. This closes a gap where such an account's password could never previously be rotated through the application itself.
