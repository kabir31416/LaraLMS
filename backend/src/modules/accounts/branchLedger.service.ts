import { Request } from "express";
import { BranchLedgerEntry, BranchLedgerEntryDoc } from "./branchLedger.model";
import { ApiError } from "../../common/utils/ApiError";
import { recordAudit } from "../../audit/auditLog.service";
import { buildMeta, parsePagination } from "../../common/utils/pagination";

export async function list(req: Request) {
  const { page, limit, skip, sort } = parsePagination(req, { date: -1 });
  const filter: Record<string, unknown> = {};
  if (req.query.branchId) filter.branchId = req.query.branchId;
  if (req.query.date) filter.date = req.query.date;

  const [items, total] = await Promise.all([
    BranchLedgerEntry.find(filter).sort(sort).skip(skip).limit(limit),
    BranchLedgerEntry.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

async function getDocOrThrow(id: string): Promise<BranchLedgerEntryDoc> {
  const doc = await BranchLedgerEntry.findById(id);
  if (!doc) throw ApiError.notFound("Branch ledger entry not found");
  return doc;
}

export async function create(req: Request, data: Partial<BranchLedgerEntryDoc>): Promise<BranchLedgerEntryDoc> {
  const doc = await BranchLedgerEntry.create(data);
  await recordAudit({ req, action: "branch-ledger.create", module: "branch-ledger", targetCollection: "branchledgerentries", targetId: String(doc._id), after: doc.toObject() });
  return doc;
}

export async function update(req: Request, id: string, patch: Partial<BranchLedgerEntryDoc>): Promise<BranchLedgerEntryDoc> {
  const doc = await getDocOrThrow(id);
  const before = doc.toObject();
  Object.assign(doc, patch);
  await doc.save();
  await recordAudit({ req, action: "branch-ledger.update", module: "branch-ledger", targetCollection: "branchledgerentries", targetId: id, before, after: doc.toObject() });
  return doc;
}

export async function remove(req: Request, id: string): Promise<void> {
  const doc = await getDocOrThrow(id);
  await doc.deleteOne();
  await recordAudit({ req, action: "branch-ledger.delete", module: "branch-ledger", targetCollection: "branchledgerentries", targetId: id, before: doc.toObject() });
}

/** Per-branch running totals across ALL entries (not the filtered/paginated list) — backs the "branch summary" table. */
export async function summary() {
  const rows = await BranchLedgerEntry.aggregate<{ _id: string; totalExpense: number; totalIncome: number }>([
    {
      $group: {
        _id: "$branchId",
        totalExpense: { $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] } },
        totalIncome: { $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] } },
      },
    },
  ]);
  return rows.map((r) => ({ branchId: String(r._id), totalExpense: r.totalExpense, totalIncome: r.totalIncome, due: r.totalExpense - r.totalIncome }));
}
