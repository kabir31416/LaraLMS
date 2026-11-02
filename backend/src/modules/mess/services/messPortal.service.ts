import { Request } from "express";
import { Types } from "mongoose";
import { ApiError } from "../../../common/utils/ApiError";
import { MessMembership } from "../models/messMembership.model";
import { MessReservation } from "../models/messReservation.model";
import { MessBill } from "../models/messBill.model";
import { MessPayment } from "../models/messPayment.model";
import { MessDepositTransaction } from "../models/messDepositTransaction.model";
import { MessSettlement } from "../models/messSettlement.model";
import { MessNotice } from "../models/messNotice.model";
import { MessComplaint } from "../models/messComplaint.model";
import { todayISO } from "../mess.utils";
import { computeBalances } from "./messLedger.service";
import { assertComplaintCategory, insertComplaint } from "./messOps.service";
import { getMessSettings } from "./messSettings.service";

/**
 * Student Portal — every query here is keyed on req.user.studentId from the
 * signed token, never on an id the client sends, so a student can only ever
 * see their own Mess membership, money and complaints.
 */
function ownStudentId(req: Request): Types.ObjectId {
  const id = req.user?.studentId;
  if (!id || !Types.ObjectId.isValid(id)) throw ApiError.forbidden("Student account required");
  return new Types.ObjectId(id);
}

function visibleNoticeFilter(studentId: Types.ObjectId, messIds: Types.ObjectId[]) {
  const today = todayISO();
  return {
    status: "active",
    publishDate: { $lte: today },
    $and: [
      { $or: [{ expiryDate: { $exists: false } }, { expiryDate: null }, { expiryDate: "" }, { expiryDate: { $gte: today } }] },
      { $or: [{ audience: "mess", messId: { $in: messIds } }, { audience: "member", studentId }] },
    ],
  };
}

export async function getMyMess(req: Request) {
  const studentId = ownStudentId(req);
  const memberships = await MessMembership.find({ studentId })
    .sort({ createdAt: -1 })
    .select("-statusHistory -ledgerSeq -createdBy")
    .populate("messId", "name code address contactNumber")
    .populate("roomId", "name floor roomType")
    .populate("seatId", "seatNumber seatType")
    .populate("seatHistory.seatId", "seatNumber")
    .populate("seatHistory.roomId", "name")
    .lean();
  const reservation = await MessReservation.findOne({ studentId, status: "active" })
    .populate("messId", "name")
    .populate("roomId", "name")
    .populate("seatId", "seatNumber")
    .select("reservationNo reservationDate expiryDate advanceAmount status messId roomId seatId")
    .lean();
  const current = memberships.find((m) => m.isOpen) ?? memberships[0] ?? null;
  if (!current) return { current: null, reservation, memberships: [], bills: [], payments: [], depositTransactions: [], settlements: [], notices: [], complaints: [], balances: null };

  const currentId = current._id as Types.ObjectId;
  const openMessIds = memberships
    .filter((m) => m.isOpen && m.messId)
    .map((m) => (m.messId as unknown as { _id: Types.ObjectId })._id);
  const [balances, bills, payments, depositTransactions, settlements, notices, complaints] = await Promise.all([
    computeBalances(currentId),
    MessBill.find({ membershipId: currentId, status: { $ne: "cancelled" } }).sort({ period: -1 }).limit(24).select("-ledgerSeqApplied -generatedBy").lean(),
    MessPayment.find({ studentId, status: "active" }).sort({ date: -1, createdAt: -1 }).limit(50).select("receiptNo purpose amount allocation billingMonth dueBefore balanceAfter method date reference membershipId").lean(),
    MessDepositTransaction.find({ membershipId: currentId, status: { $nin: ["cancelled"] } }).sort({ createdAt: -1 }).limit(50).select("txNo type amount status date reason period source").lean(),
    MessSettlement.find({ studentId, status: { $ne: "cancelled" } }).sort({ createdAt: -1 }).limit(10).select("-createdBy -approvedBy -completedBy -activeKey").lean(),
    MessNotice.find(visibleNoticeFilter(studentId, openMessIds)).sort({ publishDate: -1 }).limit(50).select("title body type publishDate expiryDate readBy audience").lean(),
    MessComplaint.find({ studentId }).sort({ createdAt: -1 }).limit(50).select("ticketNo kind category title description priority status date history.status history.note history.at").lean(),
  ]);
  return {
    current,
    reservation,
    balances: {
      due: balances.due,
      advance: balances.advance,
      totalBilled: balances.totalBilled,
      totalPaid: balances.totalPaid,
      depositRequired: balances.depositRequired,
      depositCollected: balances.depositCollected,
      depositBalance: balances.depositBalance,
      depositPendingRefund: balances.depositPendingRefund,
    },
    currentBill: bills[0] ?? null,
    memberships: memberships.map((m) => ({ _id: m._id, membershipNo: m.membershipNo, status: m.status, joiningDate: m.joiningDate, leftDate: m.leftDate, messId: m.messId, roomId: m.roomId, seatId: m.seatId })),
    bills,
    payments,
    depositTransactions,
    settlements,
    // readBy is reduced to a per-notice boolean — never another student's id list.
    notices: notices.map((n) => ({ ...n, readBy: undefined, isRead: (n.readBy ?? []).some((id) => String(id) === String(studentId)) })),
    complaints,
  };
}

export async function createMyComplaint(req: Request, body: { category: string; title: string; description?: string; priority?: "low" | "normal" | "high" | "urgent"; attachment?: { url: string; publicId?: string; resourceType?: string } }) {
  const studentId = ownStudentId(req);
  const m = await MessMembership.findOne({ studentId, status: { $in: ["approved", "active", "on_leave", "notice_given"] } });
  if (!m) throw ApiError.badRequest("আপনার কোনো সক্রিয় মেস সদস্যপদ নেই");
  await assertComplaintCategory("complaint", body.category);
  return insertComplaint(req, {
    kind: "complaint",
    messId: m.messId,
    roomId: m.roomId,
    seatId: m.seatId,
    membershipId: m._id,
    studentId,
    category: body.category,
    title: body.title,
    description: body.description,
    priority: body.priority ?? "normal",
    attachment: body.attachment,
    date: todayISO(),
  });
}

export async function markNoticeRead(req: Request, noticeId: string): Promise<{ read: true }> {
  const studentId = ownStudentId(req);
  if (!Types.ObjectId.isValid(noticeId)) throw ApiError.badRequest("Invalid notice id");
  const openMessIds = (await MessMembership.find({ studentId, isOpen: true }).distinct("messId")) as Types.ObjectId[];
  const res = await MessNotice.updateOne({ _id: new Types.ObjectId(noticeId), ...visibleNoticeFilter(studentId, openMessIds) }, { $addToSet: { readBy: studentId } });
  if (res.matchedCount === 0) throw ApiError.notFound("Notice not found");
  return { read: true };
}

export async function portalOptions() {
  const settings = await getMessSettings();
  return { complaintCategories: settings.complaintCategories };
}
