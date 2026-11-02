import { Request } from "express";
import { Types } from "mongoose";
import { ApiError } from "../../../common/utils/ApiError";
import { recordAudit } from "../../../audit/auditLog.service";
import { logger } from "../../../logger/logger";
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
import { MessNotice } from "../models/messNotice.model";
import { MessSettings } from "../models/messSettings.model";
import { toObjectId } from "../mess.utils";
import { recomputeLedger } from "./messLedger.service";
import { releaseSeat } from "./messSetup.service";

/**
 * Super Admin permanent delete — every Mess record type.
 *
 * Only the Super Admin (User.isSuperAdmin, carried in the login token) may
 * call it; every other role, including ordinary Admins, keeps the normal
 * cancel / deactivate flows. Each call must carry confirm=DELETE. The
 * deleted document (and, for cascades, what went with it) is written to the
 * AuditLog first, so the record of who deleted what remains after the data
 * is gone. Balances of every member touched are recomputed from what is left.
 */

export const DELETABLE = ["mess", "room", "seat", "membership", "reservation", "bill", "payment", "deposit-transaction", "settlement", "expense", "complaint", "notice"] as const;
export type Deletable = (typeof DELETABLE)[number];

function assertSuperAdmin(req: Request) {
  if (!req.user?.isSuperAdmin) throw ApiError.forbidden("স্থায়ীভাবে মুছে ফেলার অনুমতি শুধু সুপার অ্যাডমিনের");
}

async function recomputeAll(ids: Iterable<string>) {
  for (const id of new Set(ids)) {
    if (!(await MessMembership.exists({ _id: id }))) continue;
    try {
      await recomputeLedger(id);
    } catch (err) {
      logger.error({ err, membershipId: id }, "Ledger recompute after Super Admin delete failed");
    }
  }
}

const idsOf = (rows: { membershipId?: Types.ObjectId | null }[]) => rows.map((r) => r.membershipId).filter(Boolean).map(String);

/** Everything that belongs to the given memberships (bills, payments, deposit movements, settlements) — deleted together with them. */
async function deleteMembershipsCascade(membershipIds: Types.ObjectId[]) {
  const filter = { membershipId: { $in: membershipIds } };
  const [bills, payments, depositTx, settlements] = await Promise.all([
    MessBill.deleteMany(filter),
    MessPayment.deleteMany(filter),
    MessDepositTransaction.deleteMany(filter),
    MessSettlement.deleteMany(filter),
  ]);
  await MessComplaint.updateMany(filter, { $unset: { membershipId: "" } });
  await MessReservation.updateMany(filter, { $unset: { membershipId: "" } });
  const memberships = await MessMembership.deleteMany({ _id: { $in: membershipIds } });
  return { memberships: memberships.deletedCount, bills: bills.deletedCount, payments: payments.deletedCount, depositTransactions: depositTx.deletedCount, settlements: settlements.deletedCount };
}

export async function superDelete(req: Request, entity: string, id: string, confirm: unknown): Promise<{ deleted: true; entity: Deletable; id: string; cascade?: Record<string, number> }> {
  assertSuperAdmin(req);
  if (!DELETABLE.includes(entity as Deletable)) throw ApiError.badRequest("Unknown record type");
  if (confirm !== "DELETE") throw ApiError.badRequest("নিশ্চিত করতে confirm=DELETE দিন");
  const _id = toObjectId(id, "id");
  const kind = entity as Deletable;
  let before: unknown;
  let cascade: Record<string, number> | undefined;
  const touched: string[] = [];

  switch (kind) {
    case "bill": {
      const doc = await MessBill.findById(_id);
      if (!doc) throw ApiError.notFound("Bill not found");
      before = doc.toObject();
      await doc.deleteOne();
      touched.push(String(doc.membershipId));
      break;
    }
    case "payment": {
      const doc = await MessPayment.findById(_id);
      if (!doc) throw ApiError.notFound("Payment not found");
      before = doc.toObject();
      await doc.deleteOne();
      if (doc.membershipId) {
        touched.push(String(doc.membershipId));
        await MessMembership.updateOne({ _id: doc.membershipId, initialPaymentId: doc._id }, { $unset: { initialPaymentId: "" } });
      }
      break;
    }
    case "deposit-transaction": {
      const doc = await MessDepositTransaction.findById(_id);
      if (!doc) throw ApiError.notFound("Deposit transaction not found");
      before = doc.toObject();
      await doc.deleteOne();
      touched.push(String(doc.membershipId));
      break;
    }
    case "settlement": {
      const doc = await MessSettlement.findById(_id);
      if (!doc) throw ApiError.notFound("Settlement not found");
      before = doc.toObject();
      // Its deposit movements go with it; a checked-out member stays checked-out.
      const tx = await MessDepositTransaction.deleteMany({ settlementId: doc._id });
      await doc.deleteOne();
      await MessMembership.updateOne({ _id: doc.membershipId, settlementId: doc._id }, { $unset: { settlementId: "" } });
      cascade = { depositTransactions: tx.deletedCount };
      touched.push(String(doc.membershipId));
      break;
    }
    case "membership": {
      const doc = await MessMembership.findById(_id);
      if (!doc) throw ApiError.notFound("Membership not found");
      before = doc.toObject();
      if (doc.holdsSeat) await releaseSeat(doc.seatId, { membershipId: doc._id as Types.ObjectId });
      cascade = await deleteMembershipsCascade([doc._id as Types.ObjectId]);
      break;
    }
    case "reservation": {
      const doc = await MessReservation.findById(_id);
      if (!doc) throw ApiError.notFound("Reservation not found");
      before = doc.toObject();
      if (doc.status === "active") await releaseSeat(doc.seatId, { reservationId: doc._id as Types.ObjectId });
      // Advance money taken on a reservation that never became a membership goes with it; once converted it belongs to the member.
      const pays = await MessPayment.deleteMany({ reservationId: doc._id, membershipId: { $exists: false } });
      await doc.deleteOne();
      cascade = { payments: pays.deletedCount };
      break;
    }
    case "expense": {
      const doc = await MessExpense.findById(_id);
      if (!doc) throw ApiError.notFound("Expense not found");
      before = doc.toObject();
      await doc.deleteOne();
      break;
    }
    case "complaint": {
      const doc = await MessComplaint.findById(_id);
      if (!doc) throw ApiError.notFound("Complaint not found");
      before = doc.toObject();
      await MessExpense.updateMany({ complaintId: doc._id }, { $unset: { complaintId: "" } });
      await doc.deleteOne();
      break;
    }
    case "notice": {
      const doc = await MessNotice.findById(_id);
      if (!doc) throw ApiError.notFound("Notice not found");
      before = doc.toObject();
      await doc.deleteOne();
      break;
    }
    case "seat": {
      const doc = await MessSeat.findById(_id);
      if (!doc) throw ApiError.notFound("Seat not found");
      if (doc.currentMembershipId || doc.currentReservationId) {
        throw ApiError.conflict("এই সিটে এখন সদস্য/রিজার্ভেশন আছে — আগে সদস্যকে স্থানান্তর, চেক-আউট বা ডিলিট করুন");
      }
      before = doc.toObject();
      await doc.deleteOne();
      break;
    }
    case "room": {
      const doc = await MessRoom.findById(_id);
      if (!doc) throw ApiError.notFound("Room not found");
      const held = await MessSeat.countDocuments({ roomId: doc._id, $or: [{ currentMembershipId: { $exists: true, $ne: null } }, { currentReservationId: { $exists: true, $ne: null } }] });
      if (held > 0) throw ApiError.conflict(`এই রুমের ${held}টি সিটে সদস্য/রিজার্ভেশন আছে — আগে তাদের স্থানান্তর, চেক-আউট বা ডিলিট করুন`);
      before = doc.toObject();
      const seats = await MessSeat.deleteMany({ roomId: doc._id });
      await doc.deleteOne();
      cascade = { seats: seats.deletedCount };
      break;
    }
    case "mess": {
      const doc = await Mess.findById(_id);
      if (!doc) throw ApiError.notFound("Mess not found");
      before = doc.toObject();
      const messId = doc._id as Types.ObjectId;
      // Members of this Mess go entirely; money rows recorded under this Mess for members now elsewhere (after a transfer) go too, and those members' balances are recomputed.
      const memberIds = (await MessMembership.find({ messId }).distinct("_id")) as Types.ObjectId[];
      const strayRows = await Promise.all([
        MessBill.find({ messId, membershipId: { $nin: memberIds } }).select("membershipId").lean(),
        MessPayment.find({ messId, membershipId: { $nin: memberIds } }).select("membershipId").lean(),
        MessDepositTransaction.find({ messId, membershipId: { $nin: memberIds } }).select("membershipId").lean(),
      ]);
      touched.push(...strayRows.flatMap(idsOf));
      const members = await deleteMembershipsCascade(memberIds);
      const [bills, payments, depositTx, settlements, reservations, seats, rooms, expenses, complaints, notices] = await Promise.all([
        MessBill.deleteMany({ messId }),
        MessPayment.deleteMany({ messId }),
        MessDepositTransaction.deleteMany({ messId }),
        MessSettlement.deleteMany({ messId }),
        MessReservation.deleteMany({ messId }),
        MessSeat.deleteMany({ messId }),
        MessRoom.deleteMany({ messId }),
        MessExpense.deleteMany({ messId }),
        MessComplaint.deleteMany({ messId }),
        MessNotice.deleteMany({ messId }),
      ]);
      await MessSettings.updateMany({ defaultMessId: messId }, { $unset: { defaultMessId: "" } });
      await doc.deleteOne();
      cascade = {
        memberships: members.memberships,
        bills: members.bills + bills.deletedCount,
        payments: members.payments + payments.deletedCount,
        depositTransactions: members.depositTransactions + depositTx.deletedCount,
        settlements: members.settlements + settlements.deletedCount,
        reservations: reservations.deletedCount,
        rooms: rooms.deletedCount,
        seats: seats.deletedCount,
        expenses: expenses.deletedCount,
        complaints: complaints.deletedCount,
        notices: notices.deletedCount,
      };
      break;
    }
  }

  await recomputeAll(touched);
  await recordAudit({
    req,
    action: `mess.${kind}.permanent-delete`,
    module: "mess",
    targetCollection: kind,
    targetId: id,
    before,
    after: { deleted: true, by: "super_admin", cascade },
  });
  return { deleted: true, entity: kind, id, cascade };
}
