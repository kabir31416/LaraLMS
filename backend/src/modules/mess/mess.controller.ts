import { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { sendSuccess } from "../../common/utils/apiResponse";
import { ApiError } from "../../common/utils/ApiError";
import { uploadMessAttachment } from "../../common/utils/cloudinaryService";
import * as setup from "./services/messSetup.service";
import * as members from "./services/messMembership.service";
import * as billing from "./services/messBilling.service";
import * as payments from "./services/messPayment.service";
import * as deposits from "./services/messDeposit.service";
import * as ops from "./services/messOps.service";
import * as reports from "./services/messReport.service";
import * as portal from "./services/messPortal.service";
import * as settings from "./services/messSettings.service";

/** Thin HTTP layer — every rule (scope, money, state transitions) lives in the services. */
const ok = (fn: (req: Request) => Promise<unknown>, status = 200) =>
  asyncHandler(async (req: Request, res: Response) => {
    sendSuccess(res, await fn(req), status);
  });
const paged = (fn: (req: Request) => Promise<{ items: unknown; meta: Record<string, unknown> }>) =>
  asyncHandler(async (req: Request, res: Response) => {
    const { items, meta } = await fn(req);
    sendSuccess(res, items, 200, meta);
  });

// Settings & dashboard
export const getSettings = ok(() => settings.getMessSettings());
export const updateSettings = ok((req) => settings.updateMessSettings(req, req.body));
export const dashboard = ok((req) => reports.dashboard(req));

// Upload (attachment URL is then sent with the expense/complaint/member form)
export const upload = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.badRequest("কোনো ফাইল পাওয়া যায়নি");
  const seed = `mess_${req.user?.id ?? "user"}`;
  sendSuccess(res, await uploadMessAttachment(req.file.buffer, seed), 201);
});

// Messes
export const listMesses = ok((req) => setup.listMesses(req));
export const getMess = ok((req) => setup.getMess(req, req.params.id));
export const createMess = ok((req) => setup.createMess(req, req.body), 201);
export const updateMess = ok((req) => setup.updateMess(req, req.params.id, req.body));
export const setMessStaff = ok((req) => setup.setMessStaff(req, req.params.id, req.body.staff));
export const deleteMess = ok(async (req) => {
  await setup.deleteMess(req, req.params.id);
  return { deleted: true };
});
export const staffOptions = ok(() => setup.staffOptions());

// Rooms & seats
export const listRooms = ok((req) => setup.listRooms(req));
export const createRoom = ok((req) => setup.createRoom(req, req.body), 201);
export const updateRoom = ok((req) => setup.updateRoom(req, req.params.id, req.body));
export const deleteRoom = ok(async (req) => {
  await setup.deleteRoom(req, req.params.id);
  return { deleted: true };
});
export const listSeats = paged((req) => setup.listSeats(req));
export const createSeats = ok((req) => setup.createSeats(req, req.body), 201);
export const updateSeat = ok((req) => setup.updateSeat(req, req.params.id, req.body));
export const deleteSeat = ok(async (req) => {
  await setup.deleteSeat(req, req.params.id);
  return { deleted: true };
});
export const seatHistory = ok((req) => setup.seatHistory(req, req.params.id));

// Members & reservations
export const searchStudents = ok((req) => members.searchStudents(req));
export const listMemberships = paged((req) => members.listMemberships(req));
export const getMembership = ok((req) => members.getMembershipProfile(req, req.params.id));
export const createMembership = ok((req) => members.createMembership(req, req.body), 201);
export const updateMembership = ok((req) => members.updateMembershipTerms(req, req.params.id, req.body));
export const approveMembership = ok((req) => members.approveMembership(req, req.params.id, req.body));
export const rejectMembership = ok((req) => members.rejectMembership(req, req.params.id, req.body.reason));
export const activateMembership = ok((req) => members.activateMembership(req, req.params.id, req.body));
export const changeMembershipStatus = ok((req) => members.changeStatus(req, req.params.id, req.body));
export const cancelMembership = ok((req) => members.cancelMembership(req, req.params.id, req.body.reason));
export const transferMembership = ok((req) => members.transferSeat(req, req.params.id, req.body));
export const listReservations = paged((req) => members.listReservations(req));
export const createReservation = ok((req) => members.createReservation(req, req.body), 201);
export const cancelReservation = ok((req) => members.cancelReservation(req, req.params.id, req.body.reason));
export const expireReservations = ok(async (req) => ({ expired: await members.expireOverdueReservations(req) }));

// Billing
export const generationPreview = ok((req) => billing.previewGeneration(req, String(req.query.period), req.query.messId ? String(req.query.messId) : undefined));
export const generateBills = ok((req) => billing.generateBills(req, req.body), 201);
export const listBills = paged((req) => billing.listBills(req));
export const getInvoice = ok((req) => billing.getInvoice(req, req.params.id));
export const cancelBill = ok((req) => billing.cancelBill(req, req.params.id, req.body.reason));
export const adjustBill = ok((req) => billing.adjustBill(req, req.params.id, req.body));

// Payments
export const receivePayment = ok((req) => payments.receivePayment(req, req.body), 201);
export const listPayments = paged((req) => payments.listPayments(req));
export const getReceipt = ok((req) => payments.getReceipt(req, req.params.id));
export const cancelPayment = ok((req) => payments.cancelPayment(req, req.params.id, req.body.reason));
export const verifyPayment = ok((req) => payments.verifyPayment(req, req.params.id));

// Deposits & settlements
export const listDepositTransactions = paged((req) => deposits.listDepositTransactions(req));
export const createDepositTransaction = ok((req) => deposits.createDepositTransaction(req, req.params.id, req.body), 201);
export const approveDepositTransaction = ok((req) => deposits.approveDepositTransaction(req, req.params.id));
export const rejectDepositTransaction = ok((req) => deposits.rejectDepositTransaction(req, req.params.id, req.body.reason));
export const completeRefund = ok((req) => deposits.completeRefund(req, req.params.id, req.body));
export const cancelDepositTransaction = ok((req) => deposits.cancelDepositTransaction(req, req.params.id, req.body.reason));
export const settlementPreview = ok((req) => deposits.previewSettlement(req, req.params.id, Number(req.query.damageCharges ?? 0)));
export const createSettlement = ok((req) => deposits.createSettlement(req, req.params.id, req.body), 201);
export const listSettlements = paged((req) => deposits.listSettlements(req));
export const getSettlement = ok((req) => deposits.getSettlementDetail(req, req.params.id));
export const approveSettlement = ok((req) => deposits.approveSettlement(req, req.params.id));
export const completeSettlement = ok((req) => deposits.completeSettlement(req, req.params.id, req.body));
export const cancelSettlement = ok((req) => deposits.cancelSettlement(req, req.params.id, req.body.reason));

// Expenses, complaints, notices
export const listExpenses = paged((req) => ops.listExpenses(req));
export const createExpense = ok((req) => ops.createExpense(req, req.body), 201);
export const updateExpense = ok((req) => ops.updateExpense(req, req.params.id, req.body));
export const approveExpense = ok((req) => ops.decideExpense(req, req.params.id, "approved", req.body?.reason));
export const rejectExpense = ok((req) => ops.decideExpense(req, req.params.id, "rejected", req.body?.reason));
export const cancelExpense = ok((req) => ops.decideExpense(req, req.params.id, "cancelled", req.body?.reason));
export const listComplaints = paged((req) => ops.listComplaints(req));
export const getComplaint = ok((req) => ops.getComplaint(req, req.params.id));
export const createComplaint = ok((req) => ops.createComplaint(req, req.body), 201);
export const updateComplaint = ok((req) => ops.updateComplaint(req, req.params.id, req.body));
export const listNotices = paged((req) => ops.listNotices(req));
export const createNotice = ok((req) => ops.createNotice(req, req.body), 201);
export const updateNotice = ok((req) => ops.updateNotice(req, req.params.id, req.body));

// Reports
export const reportOccupancy = ok((req) => reports.occupancy(req));
export const reportJoiningLeaving = paged((req) => reports.joiningLeaving(req));
export const reportCollection = ok((req) => reports.collection(req));
export const reportBalances = paged((req) => reports.memberBalances(req));
export const reportIncomeExpense = ok((req) => reports.incomeExpense(req));
export const reportRefunds = ok((req) => reports.refunds(req));
export const reportExpenses = ok((req) => reports.expensesByDate(req));

// Student Portal
export const portalMe = ok((req) => portal.getMyMess(req));
export const portalOptions = ok(() => portal.portalOptions());
export const portalCreateComplaint = ok((req) => portal.createMyComplaint(req, req.body), 201);
export const portalMarkNoticeRead = ok((req) => portal.markNoticeRead(req, req.params.id));
