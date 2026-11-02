import { Model, Types } from "mongoose";
import { MessMembership, MembershipBalance } from "../models/messMembership.model";
import { MessBill } from "../models/messBill.model";
import { MessPayment } from "../models/messPayment.model";
import { MessDepositTransaction } from "../models/messDepositTransaction.model";
import { MessSettlement } from "../models/messSettlement.model";
import { money } from "../mess.utils";
import { logger } from "../../../logger/logger";

/**
 * The Mess ledger is never a running total updated by +/- increments (which
 * drift the moment one write is lost or retried). Every figure is recomputed
 * from the source documents themselves:
 *
 *   charges  = Σ live bills' currentCharges + Σ completed settlements' damageCharges
 *   credits  = Σ active rent payments + Σ deposit applied to dues − Σ advance refunded
 *   due      = max(0, charges − credits)      advance = max(0, credits − charges)
 *
 *   deposit balance = Σ active deposit payments − applied − deducted − refunded
 *
 * A refundable security deposit is tracked entirely apart from rent dues and
 * is never counted as income.
 */
export interface LedgerBalances extends MembershipBalance {
  charges: number;
  credits: number;
  depositApplied: number;
  depositDeducted: number;
  depositRefunded: number;
  advanceRefunded: number;
  settlementCharges: number;
}

type SumRow = { _id: string | null; total: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sumBy(model: Model<any>, match: Record<string, unknown>, field: string, groupField?: string): Promise<SumRow[]> {
  return model.aggregate<SumRow>([{ $match: match }, { $group: { _id: groupField ? `$${groupField}` : null, total: { $sum: `$${field}` } } }]);
}

export async function computeBalances(membershipId: Types.ObjectId): Promise<LedgerBalances> {
  const [membership, billRows, settlementRows, paymentRows, depositTxRows, pendingRefundRows] = await Promise.all([
    MessMembership.findById(membershipId).select("securityDeposit").lean(),
    sumBy(MessBill, { membershipId, status: { $ne: "cancelled" } }, "currentCharges"),
    MessSettlement.aggregate<{ _id: null; damage: number; advanceRefund: number }>([
      { $match: { membershipId, status: "completed" } },
      { $group: { _id: null, damage: { $sum: "$damageCharges" }, advanceRefund: { $sum: "$advanceRefund" } } },
    ]),
    sumBy(MessPayment, { membershipId, status: "active" }, "amount", "purpose"),
    MessDepositTransaction.aggregate<{ _id: string; total: number }>([
      {
        $match: {
          membershipId,
          $or: [
            { type: { $in: ["deduct", "apply_to_due"] }, status: { $in: ["approved", "completed"] } },
            { type: "refund", status: "completed" },
          ],
        },
      },
      { $group: { _id: "$type", total: { $sum: "$amount" } } },
    ]),
    sumBy(MessDepositTransaction, { membershipId, type: "refund", status: { $in: ["pending", "approved"] } }, "amount"),
  ]);

  const billCharges = money(billRows[0]?.total ?? 0);
  const settlementCharges = money(settlementRows[0]?.damage ?? 0);
  const advanceRefunded = money(settlementRows[0]?.advanceRefund ?? 0);
  const rentPaid = money(paymentRows.find((r) => r._id === "rent")?.total ?? 0);
  const depositCollected = money(paymentRows.find((r) => r._id === "deposit")?.total ?? 0);
  const depositApplied = money(depositTxRows.find((r) => r._id === "apply_to_due")?.total ?? 0);
  const depositDeducted = money(depositTxRows.find((r) => r._id === "deduct")?.total ?? 0);
  const depositRefunded = money(depositTxRows.find((r) => r._id === "refund")?.total ?? 0);
  const depositPendingRefund = money(pendingRefundRows[0]?.total ?? 0);

  const charges = money(billCharges + settlementCharges);
  const credits = money(rentPaid + depositApplied - advanceRefunded);
  return {
    charges,
    credits,
    totalBilled: charges,
    totalPaid: money(rentPaid + depositApplied),
    due: money(Math.max(0, charges - credits)),
    advance: money(Math.max(0, credits - charges)),
    depositRequired: money(membership?.securityDeposit ?? 0),
    depositCollected,
    depositApplied,
    depositDeducted,
    depositRefunded,
    depositPendingRefund,
    depositBalance: money(depositCollected - depositApplied - depositDeducted - depositRefunded),
    advanceRefunded,
    settlementCharges,
  };
}

/**
 * Pure FIFO allocation of a member's total credits across their live bills
 * (oldest first). Bills always predate a leaving settlement's damage charge,
 * so they take credits first; whatever is left is the member's advance.
 */
export function allocateFifo<T extends { _id: unknown; currentCharges: number }>(
  billsOldestFirst: T[],
  credits: number,
): { _id: T["_id"]; paidAmount: number; dueAmount: number; status: "paid" | "partial" | "unpaid" }[] {
  let remaining = Math.max(0, money(credits));
  return billsOldestFirst.map((b) => {
    const paid = money(Math.min(b.currentCharges, remaining));
    remaining = money(remaining - paid);
    const due = money(b.currentCharges - paid);
    const status: "paid" | "partial" | "unpaid" = due <= 0 ? "paid" : paid > 0 ? "partial" : "unpaid";
    return { _id: b._id, paidAmount: paid, dueAmount: due, status };
  });
}

/**
 * Recomputes and stores a membership's cached balance + each bill's
 * FIFO-allocated paid/due/status.
 *
 * No MongoDB transactions are assumed, so concurrent financial writes are
 * made safe by sequencing instead: the caller's mutation has already been
 * written; we atomically bump `ledgerSeq`, read the sources, then write the
 * result ONLY IF `ledgerSeq` is still ours. If another mutation landed in
 * between, its own recompute (which started later and therefore read
 * everything) wins, and ours is discarded — the stored figures can never go
 * backwards to a stale value. Bills use the same sequence (ledgerSeqApplied).
 */
export async function recomputeLedger(membershipId: Types.ObjectId | string): Promise<LedgerBalances> {
  const id = typeof membershipId === "string" ? new Types.ObjectId(membershipId) : membershipId;
  const bumped = await MessMembership.findOneAndUpdate({ _id: id }, { $inc: { ledgerSeq: 1 } }, { new: true }).select("ledgerSeq");
  if (!bumped) throw new Error(`Membership ${String(id)} not found for ledger recompute`);
  const seq = bumped.ledgerSeq;

  const balances = await computeBalances(id);

  // FIFO: credits pay off the oldest live bill first.
  const bills = await MessBill.find({ membershipId: id, status: { $ne: "cancelled" } })
    .sort({ period: 1, createdAt: 1 })
    .select("currentCharges paidAmount dueAmount status")
    .lean();
  const billOps = allocateFifo(bills, balances.credits).map((a) => ({
    updateOne: {
      filter: { _id: a._id, ledgerSeqApplied: { $lt: seq } },
      update: { $set: { paidAmount: a.paidAmount, dueAmount: a.dueAmount, status: a.status, ledgerSeqApplied: seq } },
    },
  }));

  const written = await MessMembership.updateOne(
    { _id: id, ledgerSeq: seq },
    {
      $set: {
        balance: {
          totalBilled: balances.totalBilled,
          totalPaid: balances.totalPaid,
          due: balances.due,
          advance: balances.advance,
          depositRequired: balances.depositRequired,
          depositCollected: balances.depositCollected,
          depositBalance: balances.depositBalance,
          depositPendingRefund: balances.depositPendingRefund,
          updatedAt: new Date(),
        },
      },
    },
  );
  if (written.modifiedCount > 0 && billOps.length) {
    try {
      await MessBill.bulkWrite(billOps, { ordered: false });
    } catch (err) {
      logger.error({ err, membershipId: String(id) }, "Failed to write Mess bill allocation");
    }
  }
  return balances;
}
