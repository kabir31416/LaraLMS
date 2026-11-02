import { Router } from "express";
import { requireAuth } from "../../common/middlewares/auth.middleware";
import { requirePermission } from "../../common/middlewares/rbac.middleware";
import { validate } from "../../common/middlewares/validate.middleware";
import { attachmentUpload } from "../../common/middlewares/imageUpload.middleware";
import { PERMISSIONS as P } from "../rbac/permissions";
import * as c from "./mess.controller";
import * as v from "./mess.validation";

/**
 * /api/v1/mess — Mess / Hostel Management.
 * requirePermission decides "may this role do this action"; Mess-level scope
 * ("which Mess") is enforced again inside every service (mess.scope.ts).
 * Fixed-segment paths are always registered before their "/:id" siblings.
 */
const router = Router();

// Backend scheduler entry point for serverless hosting (Vercel Cron, see
// backend/vercel.json). Authenticated by the CRON_SECRET bearer token, so it
// is registered BEFORE requireAuth; it fails closed when CRON_SECRET is unset.
router.get("/cron/monthly-billing", c.cronMonthlyBilling);

router.use(requireAuth);

const view = requirePermission(P.MESS_VIEW);
const manage = requirePermission(P.MESS_MANAGE);
const membersManage = requirePermission(P.MESS_MEMBERS_MANAGE);
const approveMembers = requirePermission(P.MESS_MEMBERS_APPROVE);
const billingManage = requirePermission(P.MESS_BILLING_MANAGE);
const collect = requirePermission(P.MESS_PAYMENTS_COLLECT);
const financeApprove = requirePermission(P.MESS_FINANCE_APPROVE);
const expensesAny = requirePermission(P.MESS_EXPENSES_MANAGE, P.MESS_EXPENSES_APPROVE, P.MESS_REPORTS_READ);
const complaintsManage = requirePermission(P.MESS_COMPLAINTS_MANAGE);
const noticesManage = requirePermission(P.MESS_NOTICES_MANAGE);
const reportsRead = requirePermission(P.MESS_REPORTS_READ);
const own = requirePermission(P.MESS_READ_OWN);

// Student Portal (own data only — identity comes from the token)
router.get("/portal/me", own, c.portalMe);
router.get("/portal/options", own, c.portalOptions);
router.post("/portal/complaints", own, validate(v.portalComplaintSchema), c.portalCreateComplaint);
router.post("/portal/notices/:id/read", own, validate(v.idParamSchema), c.portalMarkNoticeRead);

router.post("/uploads", requirePermission(P.MESS_VIEW, P.MESS_READ_OWN), attachmentUpload.single("file"), c.upload);

router.get("/settings", requirePermission(P.MESS_VIEW, P.MESS_SETTINGS_MANAGE), c.getSettings);
router.patch("/settings", requirePermission(P.MESS_SETTINGS_MANAGE), validate(v.updateMessSettingsSchema), c.updateSettings);
router.get("/dashboard", view, validate(v.listQuerySchema), c.dashboard);

// Messes
router.get("/staff-options", manage, c.staffOptions);
router.get("/messes", view, validate(v.listQuerySchema), c.listMesses);
router.post("/messes", manage, validate(v.createMessSchema), c.createMess);
router.get("/messes/:id", view, validate(v.idParamSchema), c.getMess);
router.patch("/messes/:id", manage, validate(v.updateMessSchema), c.updateMess);
router.patch("/messes/:id/staff", manage, validate(v.setMessStaffSchema), c.setMessStaff);
router.delete("/messes/:id", manage, validate(v.idParamSchema), c.deleteMess);

// Rooms & seats
router.get("/rooms", view, validate(v.listQuerySchema), c.listRooms);
router.post("/rooms", manage, validate(v.createRoomSchema), c.createRoom);
router.patch("/rooms/:id", manage, validate(v.updateRoomSchema), c.updateRoom);
router.delete("/rooms/:id", manage, validate(v.idParamSchema), c.deleteRoom);
router.get("/seats", view, validate(v.listQuerySchema), c.listSeats);
router.post("/seats", manage, validate(v.createSeatsSchema), c.createSeats);
router.get("/seats/:id/history", view, validate(v.idParamSchema), c.seatHistory);
router.patch("/seats/:id", manage, validate(v.updateSeatSchema), c.updateSeat);
router.delete("/seats/:id", manage, validate(v.idParamSchema), c.deleteSeat);

// Members
router.get("/students/search", membersManage, validate(v.listQuerySchema), c.searchStudents);
router.get("/memberships", view, validate(v.listQuerySchema), c.listMemberships);
router.post("/memberships", membersManage, validate(v.createMembershipSchema), c.createMembership);
router.get("/memberships/:id", view, validate(v.idParamSchema), c.getMembership);
router.patch("/memberships/:id", membersManage, validate(v.updateMembershipSchema), c.updateMembership);
router.post("/memberships/:id/approve", approveMembers, validate(v.approveMembershipSchema), c.approveMembership);
router.post("/memberships/:id/reject", approveMembers, validate(v.reasonSchema), c.rejectMembership);
router.post("/memberships/:id/activate", approveMembers, validate(v.activateMembershipSchema), c.activateMembership);
router.post("/memberships/:id/status", membersManage, validate(v.changeStatusSchema), c.changeMembershipStatus);
router.post("/memberships/:id/cancel", membersManage, validate(v.reasonSchema), c.cancelMembership);
router.post("/memberships/:id/transfer", membersManage, validate(v.transferSchema), c.transferMembership);
router.get("/memberships/:id/joining-date-preview", requirePermission(P.MESS_MEMBERS_EDIT_DATES), validate(v.joiningDatePreviewSchema), c.joiningDatePreview);
router.post("/memberships/:id/joining-date", requirePermission(P.MESS_MEMBERS_EDIT_DATES), validate(v.joiningDateChangeSchema), c.changeJoiningDate);
router.post("/memberships/:id/initial-charges", collect, validate(v.initialChargesSchema), c.applyInitialCharges);
router.post("/memberships/:id/deposit-transactions", collect, validate(v.createDepositTxSchema), c.createDepositTransaction);
router.get("/memberships/:id/settlement-preview", view, validate(v.settlementPreviewSchema), c.settlementPreview);
router.post("/memberships/:id/settlements", requirePermission(P.MESS_MEMBERS_MANAGE, P.MESS_FINANCE_APPROVE), validate(v.createSettlementSchema), c.createSettlement);

// Reservations
router.get("/reservations", view, validate(v.listQuerySchema), c.listReservations);
router.post("/reservations", membersManage, validate(v.createReservationSchema), c.createReservation);
router.post("/reservations/expire-overdue", membersManage, c.expireReservations);
router.post("/reservations/:id/cancel", membersManage, validate(v.reasonSchema), c.cancelReservation);

// Bills
router.get("/bills", view, validate(v.listQuerySchema), c.listBills);
router.get("/bills/generation-preview", billingManage, validate(v.generationPreviewSchema), c.generationPreview);
router.post("/bills/generate", billingManage, validate(v.generateBillsSchema), c.generateBills);
router.get("/bills/:id/invoice", requirePermission(P.MESS_VIEW, P.MESS_READ_OWN), validate(v.idParamSchema), c.getInvoice);
router.post("/bills/:id/cancel", billingManage, validate(v.reasonSchema), c.cancelBill);
router.post("/bills/:id/adjust", billingManage, validate(v.adjustBillSchema), c.adjustBill);

// Payments
router.get("/payments", view, validate(v.listQuerySchema), c.listPayments);
router.post("/payments", collect, validate(v.receivePaymentSchema), c.receivePayment);
router.get("/payments/:id/receipt", requirePermission(P.MESS_VIEW, P.MESS_READ_OWN), validate(v.idParamSchema), c.getReceipt);
router.post("/payments/:id/cancel", requirePermission(P.MESS_PAYMENTS_CANCEL), validate(v.reasonSchema), c.cancelPayment);
router.post("/payments/:id/verify", financeApprove, validate(v.idParamSchema), c.verifyPayment);

// Deposit movements
router.get("/deposit-transactions", view, validate(v.listQuerySchema), c.listDepositTransactions);
router.post("/deposit-transactions/:id/approve", financeApprove, validate(v.idParamSchema), c.approveDepositTransaction);
router.post("/deposit-transactions/:id/reject", financeApprove, validate(v.reasonSchema), c.rejectDepositTransaction);
router.post("/deposit-transactions/:id/complete-refund", collect, validate(v.completeRefundSchema), c.completeRefund);
router.post("/deposit-transactions/:id/cancel", financeApprove, validate(v.reasonSchema), c.cancelDepositTransaction);

// Settlements
router.get("/settlements", view, validate(v.listQuerySchema), c.listSettlements);
router.get("/settlements/:id", requirePermission(P.MESS_VIEW, P.MESS_READ_OWN), validate(v.idParamSchema), c.getSettlement);
router.post("/settlements/:id/approve", financeApprove, validate(v.idParamSchema), c.approveSettlement);
router.post("/settlements/:id/complete", financeApprove, validate(v.completeSettlementSchema), c.completeSettlement);
router.post("/settlements/:id/cancel", requirePermission(P.MESS_MEMBERS_MANAGE, P.MESS_FINANCE_APPROVE), validate(v.reasonSchema), c.cancelSettlement);

// Expenses
router.get("/expenses", expensesAny, validate(v.listQuerySchema), c.listExpenses);
router.post("/expenses", requirePermission(P.MESS_EXPENSES_MANAGE), validate(v.createExpenseSchema), c.createExpense);
router.patch("/expenses/:id", requirePermission(P.MESS_EXPENSES_MANAGE, P.MESS_EXPENSES_APPROVE), validate(v.updateExpenseSchema), c.updateExpense);
router.post("/expenses/:id/approve", requirePermission(P.MESS_EXPENSES_APPROVE), validate(v.optionalReasonSchema), c.approveExpense);
router.post("/expenses/:id/reject", requirePermission(P.MESS_EXPENSES_APPROVE), validate(v.reasonSchema), c.rejectExpense);
router.post("/expenses/:id/cancel", requirePermission(P.MESS_EXPENSES_MANAGE, P.MESS_EXPENSES_APPROVE), validate(v.optionalReasonSchema), c.cancelExpense);

// Complaints & maintenance
router.get("/complaints", requirePermission(P.MESS_COMPLAINTS_MANAGE, P.MESS_VIEW), validate(v.listQuerySchema), c.listComplaints);
router.post("/complaints", complaintsManage, validate(v.createComplaintSchema), c.createComplaint);
router.get("/complaints/:id", requirePermission(P.MESS_COMPLAINTS_MANAGE, P.MESS_VIEW), validate(v.idParamSchema), c.getComplaint);
router.patch("/complaints/:id", complaintsManage, validate(v.updateComplaintSchema), c.updateComplaint);

// Notices
router.get("/notices", view, validate(v.listQuerySchema), c.listNotices);
router.post("/notices", noticesManage, validate(v.createNoticeSchema), c.createNotice);
router.patch("/notices/:id", noticesManage, validate(v.updateNoticeSchema), c.updateNotice);

// Mess SMS (delivery always through the shared SMS module; no keys here)
router.post("/sms/test", requirePermission(P.MESS_SETTINGS_MANAGE), validate(v.testMessSmsSchema), c.testSms);
router.post("/sms/due-reminders", requirePermission(P.MESS_PAYMENTS_COLLECT, P.MESS_BILLING_MANAGE), validate(v.dueReminderSchema), c.sendDueReminders);
router.get("/sms/logs", requirePermission(P.MESS_REPORTS_READ, P.MESS_SETTINGS_MANAGE), validate(v.listQuerySchema), c.listSmsLogs);
router.post("/sms/logs/:id/delivery", requirePermission(P.MESS_REPORTS_READ, P.MESS_SETTINGS_MANAGE), validate(v.idParamSchema), c.checkSmsDelivery);

// Super Admin only: permanent delete of any Mess record (checked in the service; audit-logged)
router.delete("/admin/:entity/:id", validate(v.superDeleteSchema), c.superDelete);

// Reports
router.get("/reports/monthly-summary", reportsRead, validate(v.listQuerySchema), c.reportMonthlySummary);
router.get("/reports/previous-due", reportsRead, validate(v.listQuerySchema), c.reportPreviousDue);
router.get("/reports/occupancy", reportsRead, validate(v.listQuerySchema), c.reportOccupancy);
router.get("/reports/joining-leaving", reportsRead, validate(v.listQuerySchema), c.reportJoiningLeaving);
router.get("/reports/collection", reportsRead, validate(v.listQuerySchema), c.reportCollection);
router.get("/reports/balances", reportsRead, validate(v.listQuerySchema), c.reportBalances);
router.get("/reports/income-expense", reportsRead, validate(v.listQuerySchema), c.reportIncomeExpense);
router.get("/reports/refunds", reportsRead, validate(v.listQuerySchema), c.reportRefunds);
router.get("/reports/expenses", reportsRead, validate(v.listQuerySchema), c.reportExpenses);

export default router;
