# Document 08 — Client Handover Checklist

The concrete steps to complete before this system goes live for a real client, drawn directly from the production-readiness audit performed on this codebase. Check items off in order — several depend on the one before it.

## Before deployment

- [ ] Provision the production MongoDB instance and record its connection string.
- [ ] Generate strong, unique values for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` (these have no default — the app will not start without them).
- [ ] Set `CORS_ORIGIN` (backend) to the real production frontend URL — not `http://localhost:5173`.
- [ ] Set `VITE_API_URL` (frontend build) to the real production backend API URL — not the `localhost:5000` default.
- [ ] Decide on SMS gateway credentials (`SMS_API_KEY`, `SMS_SENDER_ID`, `SMS_API_URL`, `SMS_SIGNATURE`) if guardian/result SMS is required at launch; otherwise leave blank (SMS sending will simply be skipped, not error).
- [ ] Decide on Cloudinary credentials if logo/image upload is required at launch.

## First boot

- [ ] Run the backend build (`npm run build`) and start it (`npm run start`) against the production database.
- [ ] Run `npm run seed` **once** to create the first (Super Admin) login.
- [ ] Build the frontend (`npm run build`) with the production `VITE_API_URL` and deploy the resulting `dist/` folder.

## Immediately after first login — do this before anyone else can reach the system

- [ ] **Log in as the seeded Super Admin.** You will be shown a full-screen "set a new password" prompt — this is expected and cannot be skipped.
- [ ] **Set a strong new password.** The seeded default (`ChangeMe123!` unless you changed `ADMIN_SEED_PASSWORD` before seeding) must never remain active on a publicly-reachable instance.
- [ ] Confirm you can now reach the normal Admin dashboard after setting the password.

## Manual functional walkthrough (recommended before handing over to end users)

These were verified by direct code review during the audit but **not** executed live (no database/browser was available in the development environment) — a real click-through is recommended:

- [ ] Create a second Admin account with some modules deliberately unchecked; confirm those modules are hidden from that Admin's sidebar and that navigating to them directly is blocked.
- [ ] Admit one student manually; confirm the Registration ID is generated automatically and the Roll Number you typed is stored separately.
- [ ] Record a payment for that student, confirm the receipt prints correctly with the institution's real logo/name/address (set these in Settings → Institution first).
- [ ] Record a second, different payment for the same student — confirm both payments exist independently (this system deliberately never limits a student to one payment).
- [ ] As a Batch Director, enter results for a batch using "Save Result" (confirm no SMS is sent), then use "Send Result" for a small batch and confirm the guardian SMS actually arrives (if SMS is configured).
- [ ] Log in as a Student (phone + roll number) and confirm they only see their own data.
- [ ] If you plan to use the Public Marksheet or Public Student Info pages, enable them in Settings and confirm they show only the fields you intend, and that they correctly reject/hide anything not published.
- [ ] Test the Change Password screen from the Topbar user menu, and test what happens when the Super Admin resets someone else's password (that user should be forced through the same screen on next login).
- [ ] Check the Payment Receipt and Public Marksheet print layouts on an actual printer or PDF export, at the paper size you intend to use.

## Known limitations to communicate to the client (see Document 06 for full detail)

- [ ] Video Class is a browser-only YouTube-link feature, not a real video hosting system.
- [ ] Only "Everyone / Course / Batch" notice targeting currently reaches anyone — "Director" and "Staff" targeting is stored but not yet surfaced on a screen.
- [ ] The Result report's on-screen Course filter does not currently affect its results.
- [ ] There is no UI to create custom roles beyond the three built in.
- [ ] Deployment today is a manual process — no Docker/CI pipeline exists yet.

## Sign-off

This checklist should be completed and initialed by whoever performs the production deployment before the system is considered live. This audit's own verification levels are explained in Document 06 — nothing above was claimed as tested that was not actually tested during the audit.
