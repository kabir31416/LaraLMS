import { Request } from "express";
import { Types } from "mongoose";
import { buildMeta, parsePagination } from "../../../common/utils/pagination";
import { Mess } from "../models/mess.model";
import { MessRoom } from "../models/messRoom.model";
import { MessSeat } from "../models/messSeat.model";
import { MessMembership } from "../models/messMembership.model";
import { MessReservation } from "../models/messReservation.model";
import { MessBill } from "../models/messBill.model";
import { MessPayment } from "../models/messPayment.model";
import { MessDepositTransaction } from "../models/messDepositTransaction.model";
import { MessSettlement } from "../models/messSettlement.model";
import { MessExpense } from "../models/messExpense.model";
import { MessComplaint } from "../models/messComplaint.model";
import { hasPerm, messScopeFilter } from "../mess.scope";
import { PERMISSIONS } from "../../rbac/permissions";
import { currentPeriod, money, toObjectId } from "../mess.utils";
import { expireOverdueReservations, resolveStudentFilter } from "./messMembership.service";
import { PAYMENT_DEPOSIT_PART, PAYMENT_RENT_PART } from "./messLedger.service";
import { getMessSettings } from "./messSettings.service";
import { messSmsAttention } from "./messSms.service";
import { monthKeysEnding } from "../../../common/utils/localDate";

/**
 * Mess reports are all server-side aggregates or paginated lists. Reports
 * that are just a filtered list of one collection (member list, available
 * seats, student-wise bills, payment history, expense list, membership
 * history) reuse the normal list endpoints with their filters instead of a
 * duplicate report-only query here.
 */

function range(req: Request): { from?: string; to?: string } {
  return { from: typeof req.query.dateFrom === "string" && req.query.dateFrom ? req.query.dateFrom : undefined, to: typeof req.query.dateTo === "string" && req.query.dateTo ? req.query.dateTo : undefined };
}

function rangeMatch(field: string, r: { from?: string; to?: string }): Record<string, unknown> {
  if (!r.from && !r.to) return {};
  return { [field]: { ...(r.from ? { $gte: r.from } : {}), ...(r.to ? { $lte: r.to } : {}) } };
}

async function scopeMatch(req: Request): Promise<Record<string, unknown>> {
  const scope = await messScopeFilter(req, req.query.messId);
  return scope ? { messId: scope } : {};
}

export async function dashboard(req: Request) {
  await expireOverdueReservations();
  const scope = await scopeMatch(req);
  const period = currentPeriod();
  const monthStart = `${period}-01`;
  const monthEnd = `${period}-31`;
  const [messCount, roomCount, seats, members, pendingApps, reservations, billed, collected, balances, expenses, openComplaints, pendingExpenses, pendingDeposits, pendingSettlements] = await Promise.all([
    Mess.countDocuments(scope.messId ? { _id: scope.messId } : {}),
    MessRoom.countDocuments(scope),
    MessSeat.aggregate<{ _id: string; count: number }>([{ $match: scope }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    MessMembership.aggregate<{ _id: string; count: number }>([{ $match: { ...scope, status: { $in: ["active", "on_leave", "notice_given", "approved"] } } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    MessMembership.countDocuments({ ...scope, status: "pending" }),
    MessReservation.countDocuments({ ...scope, status: "active" }),
    MessBill.aggregate<{ _id: null; total: number; due: number; count: number }>([
      { $match: { ...scope, period, status: { $ne: "cancelled" } } },
      { $group: { _id: null, total: { $sum: "$currentCharges" }, due: { $sum: "$dueAmount" }, count: { $sum: 1 } } },
    ]),
    MessPayment.aggregate<{ _id: null; rent: number; deposit: number; count: number }>([
      { $match: { ...scope, status: "active", date: { $gte: monthStart, $lte: monthEnd } } },
      { $group: { _id: null, rent: { $sum: PAYMENT_RENT_PART }, deposit: { $sum: PAYMENT_DEPOSIT_PART }, count: { $sum: 1 } } },
    ]),
    MessMembership.aggregate<{ _id: null; due: number; advance: number; deposit: number }>([
      { $match: scope },
      { $group: { _id: null, due: { $sum: "$balance.due" }, advance: { $sum: "$balance.advance" }, deposit: { $sum: "$balance.depositBalance" } } },
    ]),
    MessExpense.aggregate<{ _id: null; total: number }>([
      { $match: { ...scope, status: "approved", date: { $gte: monthStart, $lte: monthEnd } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    MessComplaint.countDocuments({ ...scope, status: { $in: ["open", "in_progress", "waiting"] } }),
    MessExpense.countDocuments({ ...scope, status: "pending" }),
    MessDepositTransaction.countDocuments({ ...scope, status: "pending" }),
    MessSettlement.countDocuments({ ...scope, status: { $in: ["pending", "approved"] } }),
  ]);
  const [previousDueRows, recentAdmissions, recentCheckouts, messRuns, settings, sms] = await Promise.all([
    // Due still open on bills from earlier months ("পূর্বের বকেয়া") vs this month's bills.
    MessBill.aggregate<{ _id: null; due: number; members: string[] }>([
      { $match: { ...scope, period: { $lt: period }, status: { $in: ["unpaid", "partial"] } } },
      { $group: { _id: null, due: { $sum: "$dueAmount" }, members: { $addToSet: "$membershipId" } } },
    ]),
    MessMembership.find({ ...scope, status: { $nin: ["pending", "cancelled"] } })
      .sort({ joiningDate: -1, createdAt: -1 })
      .limit(6)
      .select("membershipNo studentId messId seatId joiningDate status")
      .populate("studentId", "name registrationId")
      .populate("messId", "name")
      .populate("seatId", "seatNumber")
      .lean(),
    MessMembership.find({ ...scope, status: "left", leftDate: { $exists: true } })
      .sort({ leftDate: -1 })
      .limit(6)
      .select("membershipNo studentId messId leftDate status")
      .populate("studentId", "name registrationId")
      .populate("messId", "name")
      .lean(),
    Mess.find({ ...(scope.messId ? { _id: scope.messId } : {}), status: "active" }).select("name billingDay autoBilledPeriod autoBillingLastRun").lean(),
    getMessSettings(),
    messSmsAttention(scope.messId ? (scope.messId instanceof Types.ObjectId ? [scope.messId] : (scope.messId as { $in: Types.ObjectId[] }).$in) : null),
  ]);
  const billedThisMonth = messRuns.filter((m) => m.autoBilledPeriod === period).length;
  const lastRuns = messRuns.map((m) => m.autoBillingLastRun).filter((r): r is NonNullable<typeof r> => !!r && r.period === period);
  const seatCounts: Record<string, number> = { available: 0, reserved: 0, occupied: 0, maintenance: 0, inactive: 0 };
  for (const s of seats) seatCounts[s._id] = s.count;
  const memberCounts: Record<string, number> = { active: 0, on_leave: 0, notice_given: 0, approved: 0 };
  for (const m of members) memberCounts[m._id] = m.count;
  const totalSeats = Object.values(seatCounts).reduce((a, b) => a + b, 0);
  const usableSeats = totalSeats - seatCounts.inactive;
  // Money is only shown to roles that work with Mess money (a Caretaker sees occupancy and complaints, not finances).
  const canSeeFinance = [PERMISSIONS.MESS_PAYMENTS_COLLECT, PERMISSIONS.MESS_BILLING_MANAGE, PERMISSIONS.MESS_REPORTS_READ, PERMISSIONS.MESS_FINANCE_APPROVE].some((p) => hasPerm(req, p));
  const fin = (n: number) => (canSeeFinance ? n : null);
  return {
    period,
    canSeeFinance,
    messCount,
    roomCount,
    seatCounts,
    totalSeats,
    occupancyRate: usableSeats > 0 ? Math.round(((seatCounts.occupied + seatCounts.reserved) / usableSeats) * 100) : 0,
    memberCounts,
    activeMembers: memberCounts.active + memberCounts.on_leave + memberCounts.notice_given,
    pendingApplications: pendingApps,
    activeReservations: reservations,
    monthBilled: fin(money(billed[0]?.total ?? 0)),
    monthBillDue: fin(money(billed[0]?.due ?? 0)),
    monthBillCount: billed[0]?.count ?? 0,
    monthRentCollected: fin(money(collected[0]?.rent ?? 0)),
    monthDepositCollected: fin(money(collected[0]?.deposit ?? 0)),
    monthCollected: fin(money((collected[0]?.rent ?? 0) + (collected[0]?.deposit ?? 0))),
    monthPaymentCount: collected[0]?.count ?? 0,
    previousDue: fin(money(previousDueRows[0]?.due ?? 0)),
    previousDueMembers: previousDueRows[0]?.members.length ?? 0,
    recentAdmissions,
    recentCheckouts,
    sms: { failed: sms.failed, pending: sms.pending },
    autoBilling: {
      enabled: settings.autoBillingEnabled,
      period,
      billingDay: settings.billingDay,
      messes: messRuns.length,
      billedThisMonth,
      created: lastRuns.reduce((s2, r) => s2 + (r.created ?? 0), 0),
      failed: lastRuns.reduce((s2, r) => s2 + (r.failed ?? 0), 0),
      errors: lastRuns.filter((r) => r.error).length,
      lastRunAt: lastRuns.map((r) => r.at).sort().pop() ?? null,
    },
    totalDue: fin(money(balances[0]?.due ?? 0)),
    totalAdvance: fin(money(balances[0]?.advance ?? 0)),
    depositsHeld: fin(money(balances[0]?.deposit ?? 0)),
    monthExpenses: fin(money(expenses[0]?.total ?? 0)),
    openComplaints,
    pendingExpenses,
    pendingDepositRequests: pendingDeposits,
    pendingSettlements,
  };
}

export async function occupancy(req: Request) {
  const scope = await scopeMatch(req);
  const [messes, rooms, seatRows] = await Promise.all([
    Mess.find(scope.messId ? { _id: scope.messId } : {}).select("name code status").sort({ name: 1 }).lean(),
    MessRoom.find(scope).select("messId name floor roomType totalSeats status").sort({ nameKey: 1 }).lean(),
    MessSeat.aggregate<{ _id: { roomId: Types.ObjectId; status: string }; count: number }>([{ $match: scope }, { $group: { _id: { roomId: "$roomId", status: "$status" }, count: { $sum: 1 } } }]),
  ]);
  const roomStats = rooms.map((r) => {
    const counts: Record<string, number> = { available: 0, reserved: 0, occupied: 0, maintenance: 0, inactive: 0 };
    for (const row of seatRows) if (String(row._id.roomId) === String(r._id)) counts[row._id.status] = row.count;
    return { ...r, counts, seatCount: Object.values(counts).reduce((a, b) => a + b, 0) };
  });
  return messes.map((m) => {
    const mr = roomStats.filter((r) => String(r.messId) === String(m._id));
    const totals: Record<string, number> = { available: 0, reserved: 0, occupied: 0, maintenance: 0, inactive: 0 };
    for (const r of mr) for (const k of Object.keys(totals)) totals[k] += r.counts[k];
    return { mess: m, rooms: mr, totals, seatCount: Object.values(totals).reduce((a, b) => a + b, 0) };
  });
}

export async function joiningLeaving(req: Request) {
  const { page, limit, skip } = parsePagination(req);
  const r = range(req);
  const scope = await scopeMatch(req);
  const mode = req.query.mode === "leaving" ? "leaving" : "joining";
  const filter: Record<string, unknown> = { ...scope, ...(mode === "leaving" ? { leftDate: { $exists: true, ...(r.from ? { $gte: r.from } : {}), ...(r.to ? { $lte: r.to } : {}) } } : { status: { $nin: ["pending", "cancelled"] }, ...rangeMatch("joiningDate", r) }) };
  const studentIds = await resolveStudentFilter(req);
  if (studentIds) filter.studentId = { $in: studentIds };
  const [items, total] = await Promise.all([
    MessMembership.find(filter)
      .sort(mode === "leaving" ? { leftDate: -1 } : { joiningDate: -1 })
      .skip(skip)
      .limit(limit)
      .select("membershipNo studentId messId roomId seatId joiningDate leftDate status monthlyRent")
      .populate("studentId", "name registrationId currentRollNumber phone")
      .populate("messId", "name")
      .populate("roomId", "name")
      .populate("seatId", "seatNumber")
      .lean(),
    MessMembership.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

export async function collection(req: Request) {
  const r = range(req);
  const scope = await scopeMatch(req);
  const match: Record<string, unknown> = { ...scope, status: "active", ...rangeMatch("date", r) };
  if (typeof req.query.method === "string" && req.query.method) match.method = req.query.method;
  if (typeof req.query.purpose === "string" && req.query.purpose) match.purpose = req.query.purpose;
  // Dining-charge vs advance/deposit share of each receipt (an admission receipt carries both) — never $amount grouped by purpose.
  const sums = { rent: { $sum: PAYMENT_RENT_PART }, deposit: { $sum: PAYMENT_DEPOSIT_PART }, total: { $sum: "$amount" }, count: { $sum: 1 } };
  const [byDate, byMethod, byMess, byMonth] = await Promise.all([
    MessPayment.aggregate([{ $match: match }, { $group: { _id: "$date", ...sums } }, { $sort: { _id: -1 } }, { $limit: 400 }]),
    MessPayment.aggregate([{ $match: match }, { $group: { _id: "$method", ...sums } }, { $sort: { total: -1 } }]),
    MessPayment.aggregate([
      { $match: match },
      { $group: { _id: "$messId", ...sums } },
      { $lookup: { from: "messes", localField: "_id", foreignField: "_id", as: "mess" } },
      { $project: { rent: 1, deposit: 1, total: 1, count: 1, messName: { $arrayElemAt: ["$mess.name", 0] } } },
    ]),
    MessPayment.aggregate([{ $match: match }, { $group: { _id: { $substrBytes: ["$date", 0, 7] }, ...sums } }, { $sort: { _id: -1 } }, { $limit: 36 }]),
  ]);
  return { byDate, byMethod, byMess, byMonth };
}

/**
 * Month-wise billing vs collection for the last N months: what was billed
 * (live bills of that month), how much of those bills is paid/still due
 * (FIFO), and the dining-charge money actually received in that month.
 */
export async function monthlySummary(req: Request) {
  const scope = await scopeMatch(req);
  const months = Math.min(24, Math.max(1, Number(req.query.months) || 12));
  const keys = monthKeysEnding(currentPeriod(), months);
  const [bills, payments] = await Promise.all([
    MessBill.aggregate<{ _id: string; bills: number; charges: number; paid: number; due: number; advanceAdjusted: number }>([
      { $match: { ...scope, period: { $in: keys }, status: { $ne: "cancelled" } } },
      { $group: { _id: "$period", bills: { $sum: 1 }, charges: { $sum: "$currentCharges" }, paid: { $sum: "$paidAmount" }, due: { $sum: "$dueAmount" }, advanceAdjusted: { $sum: { $ifNull: ["$advanceAdjusted", 0] } } } },
    ]),
    MessPayment.aggregate<{ _id: string; rent: number; deposit: number; count: number }>([
      { $match: { ...scope, status: "active", date: { $gte: `${keys[0]}-01`, $lte: `${keys[keys.length - 1]}-31` } } },
      { $group: { _id: { $substrBytes: ["$date", 0, 7] }, rent: { $sum: PAYMENT_RENT_PART }, deposit: { $sum: PAYMENT_DEPOSIT_PART }, count: { $sum: 1 } } },
    ]),
  ]);
  return keys
    .map((k) => {
      const b = bills.find((x) => x._id === k);
      const p = payments.find((x) => x._id === k);
      return {
        period: k,
        bills: b?.bills ?? 0,
        billed: money(b?.charges ?? 0),
        billPaid: money(b?.paid ?? 0),
        billDue: money(b?.due ?? 0),
        advanceAdjusted: money(b?.advanceAdjusted ?? 0),
        diningCollected: money(p?.rent ?? 0),
        depositCollected: money(p?.deposit ?? 0),
        receipts: p?.count ?? 0,
      };
    })
    .reverse();
}

/** Members carrying due from earlier months (previous due), oldest unpaid month first — with this month's due alongside. */
export async function previousDue(req: Request) {
  const { page, limit, skip } = parsePagination(req);
  const scope = await scopeMatch(req);
  const period = currentPeriod();
  const match: Record<string, unknown> = { ...scope, status: { $in: ["unpaid", "partial"] }, period: { $lt: period } };
  const studentIds = await resolveStudentFilter(req);
  if (studentIds) match.studentId = { $in: studentIds };
  const grouped = [
    { $match: match },
    { $group: { _id: "$membershipId", previousDue: { $sum: "$dueAmount" }, oldestPeriod: { $min: "$period" }, months: { $sum: 1 } } },
  ];
  const [rows, countRows, sumRows] = await Promise.all([
    MessBill.aggregate<{ _id: Types.ObjectId; previousDue: number; oldestPeriod: string; months: number }>([...grouped, { $sort: { oldestPeriod: 1, previousDue: -1 } }, { $skip: skip }, { $limit: limit }]),
    MessBill.aggregate<{ n: number }>([...grouped, { $count: "n" }]),
    MessBill.aggregate<{ _id: null; total: number }>([{ $match: match }, { $group: { _id: null, total: { $sum: "$dueAmount" } } }]),
  ]);
  const ids = rows.map((r) => r._id);
  const [members, current] = await Promise.all([
    MessMembership.find({ _id: { $in: ids } })
      .select("membershipNo studentId messId roomId seatId status monthlyRent balance")
      .populate("studentId", "name registrationId currentRollNumber phone")
      .populate("messId", "name")
      .populate("roomId", "name")
      .populate("seatId", "seatNumber")
      .lean(),
    MessBill.aggregate<{ _id: Types.ObjectId; due: number }>([{ $match: { membershipId: { $in: ids }, period, status: { $in: ["unpaid", "partial"] } } }, { $group: { _id: "$membershipId", due: { $sum: "$dueAmount" } } }]),
  ]);
  const items = rows.map((r) => ({
    membership: members.find((m) => String(m._id) === String(r._id)) ?? null,
    previousDue: money(r.previousDue),
    oldestPeriod: r.oldestPeriod,
    months: r.months,
    currentMonthDue: money(current.find((c) => String(c._id) === String(r._id))?.due ?? 0),
  }));
  return { items, meta: { ...buildMeta(page, limit, countRows[0]?.n ?? 0), sum: money(sumRows[0]?.total ?? 0), period } };
}

/** Dues / advances / security deposits per member, from the cached ledger balance (recomputed on every financial change). */
export async function memberBalances(req: Request) {
  const { page, limit, skip } = parsePagination(req);
  const scope = await scopeMatch(req);
  const mode = typeof req.query.mode === "string" ? req.query.mode : "dues";
  const field = mode === "advances" ? "balance.advance" : mode === "deposits" ? "balance.depositBalance" : "balance.due";
  const filter: Record<string, unknown> = { ...scope, [field]: { $gt: 0 } };
  if (typeof req.query.status === "string" && req.query.status) filter.status = { $in: req.query.status.split(",") };
  const studentIds = await resolveStudentFilter(req);
  if (studentIds) filter.studentId = { $in: studentIds };
  const [items, total, sum] = await Promise.all([
    MessMembership.find(filter)
      .sort({ [field]: -1 })
      .skip(skip)
      .limit(limit)
      .select("membershipNo studentId messId roomId seatId status monthlyRent securityDeposit balance joiningDate leftDate")
      .populate({ path: "studentId", select: "name registrationId currentRollNumber phone courseId currentBatchId", populate: { path: "currentBatchId", select: "name" } })
      .populate("messId", "name")
      .populate("roomId", "name")
      .populate("seatId", "seatNumber")
      .lean(),
    MessMembership.countDocuments(filter),
    MessMembership.aggregate<{ _id: null; total: number }>([{ $match: filter }, { $group: { _id: null, total: { $sum: `$${field}` } } }]),
  ]);
  return { items, meta: { ...buildMeta(page, limit, total), sum: money(sum[0]?.total ?? 0) } };
}

/**
 * Income vs Expense per Mess for a date range. Income is rent collected plus
 * deposit deductions the Mess kept, minus advances refunded at settlement.
 * Security deposits collected/refunded are shown separately as money held
 * on members' behalf — never as income.
 */
export async function incomeExpense(req: Request) {
  const r = range(req);
  const scope = await scopeMatch(req);
  const messes = await Mess.find(scope.messId ? { _id: scope.messId } : {}).select("name code").sort({ name: 1 }).lean();
  const ids = messes.map((m) => m._id);
  const byMess = (rows: { _id: Types.ObjectId; total: number }[], id: Types.ObjectId) => money(rows.find((x) => String(x._id) === String(id))?.total ?? 0);
  const group = { $group: { _id: "$messId", total: { $sum: "$amount" } } };
  const paidMatch = { messId: { $in: ids }, status: "active", ...rangeMatch("date", r) };
  const [rent, depositIn, deducted, refunded, advanceRefund, expenses, balances] = await Promise.all([
    MessPayment.aggregate([{ $match: paidMatch }, { $group: { _id: "$messId", total: { $sum: PAYMENT_RENT_PART } } }]),
    MessPayment.aggregate([{ $match: paidMatch }, { $group: { _id: "$messId", total: { $sum: PAYMENT_DEPOSIT_PART } } }]),
    MessDepositTransaction.aggregate([{ $match: { messId: { $in: ids }, type: "deduct", status: { $in: ["approved", "completed"] }, ...rangeMatch("date", r) } }, group]),
    MessDepositTransaction.aggregate([{ $match: { messId: { $in: ids }, type: "refund", status: "completed", ...rangeMatch("date", r) } }, group]),
    MessSettlement.aggregate([{ $match: { messId: { $in: ids }, status: "completed", ...rangeMatch("refundDate", r) } }, { $group: { _id: "$messId", total: { $sum: "$advanceRefund" } } }]),
    MessExpense.aggregate([{ $match: { messId: { $in: ids }, status: "approved", ...rangeMatch("date", r) } }, group]),
    MessMembership.aggregate([{ $match: { messId: { $in: ids } } }, { $group: { _id: "$messId", due: { $sum: "$balance.due" }, deposit: { $sum: "$balance.depositBalance" }, advance: { $sum: "$balance.advance" } } }]),
  ]);
  const rows = messes.map((m) => {
    const id = m._id as Types.ObjectId;
    const income = money(byMess(rent, id) + byMess(deducted, id) - byMess(advanceRefund, id));
    const exp = byMess(expenses, id);
    const bal = balances.find((b) => String(b._id) === String(id));
    return {
      mess: m,
      rentCollected: byMess(rent, id),
      depositDeductions: byMess(deducted, id),
      advanceRefunded: byMess(advanceRefund, id),
      income,
      expenses: exp,
      net: money(income - exp),
      depositCollected: byMess(depositIn, id),
      depositRefunded: byMess(refunded, id),
      outstandingDue: money(bal?.due ?? 0),
      advanceHeld: money(bal?.advance ?? 0),
      depositsHeld: money(bal?.deposit ?? 0),
    };
  });
  const sum = (k: keyof (typeof rows)[number]) => money(rows.reduce((s, x) => s + (typeof x[k] === "number" ? (x[k] as number) : 0), 0));
  return {
    rows,
    totals: {
      rentCollected: sum("rentCollected"),
      depositDeductions: sum("depositDeductions"),
      advanceRefunded: sum("advanceRefunded"),
      income: sum("income"),
      expenses: sum("expenses"),
      net: sum("net"),
      depositCollected: sum("depositCollected"),
      depositRefunded: sum("depositRefunded"),
      outstandingDue: sum("outstandingDue"),
      advanceHeld: sum("advanceHeld"),
      depositsHeld: sum("depositsHeld"),
    },
  };
}

export async function refunds(req: Request) {
  const r = range(req);
  const scope = await scopeMatch(req);
  const [depositRefunds, advanceRefunds] = await Promise.all([
    MessDepositTransaction.find({ ...scope, type: "refund", ...rangeMatch("date", r) })
      .sort({ date: -1 })
      .limit(500)
      .populate("studentId", "name registrationId currentRollNumber")
      .populate("messId", "name")
      .populate("membershipId", "membershipNo")
      .lean(),
    MessSettlement.find({ ...scope, status: "completed", advanceRefund: { $gt: 0 }, ...rangeMatch("refundDate", r) })
      .sort({ refundDate: -1 })
      .limit(500)
      .populate("studentId", "name registrationId currentRollNumber")
      .populate("messId", "name")
      .select("settlementNo studentId messId advanceRefund refundDate refundMethod")
      .lean(),
  ]);
  return { depositRefunds, advanceRefunds };
}

export async function expensesByDate(req: Request) {
  const r = range(req);
  const scope = await scopeMatch(req);
  const match: Record<string, unknown> = { ...scope, status: "approved", ...rangeMatch("date", r) };
  if (typeof req.query.category === "string" && req.query.category) match.category = req.query.category;
  const [byDate, byCategory, byMess] = await Promise.all([
    MessExpense.aggregate([{ $match: match }, { $group: { _id: "$date", total: { $sum: "$amount" }, count: { $sum: 1 } } }, { $sort: { _id: -1 } }, { $limit: 400 }]),
    MessExpense.aggregate([{ $match: match }, { $group: { _id: "$category", total: { $sum: "$amount" }, count: { $sum: 1 } } }, { $sort: { total: -1 } }]),
    MessExpense.aggregate([
      { $match: match },
      { $group: { _id: "$messId", total: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $lookup: { from: "messes", localField: "_id", foreignField: "_id", as: "mess" } },
      { $project: { total: 1, count: 1, messName: { $arrayElemAt: ["$mess.name", 0] } } },
    ]),
  ]);
  return { byDate, byCategory, byMess };
}

export { toObjectId };
