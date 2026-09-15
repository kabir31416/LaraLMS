import { Request } from "express";
import { Branch, BranchDoc } from "./branch.model";
import { ApiError } from "../../common/utils/ApiError";
import { recordAudit } from "../../audit/auditLog.service";
import { buildMeta, buildSearchFilter, parsePagination } from "../../common/utils/pagination";

export async function list(req: Request) {
  const { page, limit, skip, sort } = parsePagination(req, { name: 1 });
  const filter = { ...buildSearchFilter(req.query.search, ["name", "address", "director"]) };
  const [items, total] = await Promise.all([
    Branch.find(filter).sort(sort).skip(skip).limit(limit),
    Branch.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

async function getDocOrThrow(id: string): Promise<BranchDoc> {
  const doc = await Branch.findById(id);
  if (!doc) throw ApiError.notFound("Branch not found");
  return doc;
}

export async function getById(id: string): Promise<BranchDoc> {
  return getDocOrThrow(id);
}

export async function create(req: Request, data: Partial<BranchDoc>): Promise<BranchDoc> {
  const doc = await Branch.create(data);
  await recordAudit({ req, action: "branch.create", module: "branches", targetCollection: "branches", targetId: String(doc._id), after: doc.toObject() });
  return doc;
}

export async function update(req: Request, id: string, patch: Partial<BranchDoc>): Promise<BranchDoc> {
  const doc = await getDocOrThrow(id);
  const before = doc.toObject();
  Object.assign(doc, patch);
  await doc.save();
  await recordAudit({ req, action: "branch.update", module: "branches", targetCollection: "branches", targetId: id, before, after: doc.toObject() });
  return doc;
}

export async function remove(req: Request, id: string): Promise<void> {
  const doc = await getDocOrThrow(id);

  const { IncomeEntry } = await import("../accounts/income.model");
  const { ExpenseEntry } = await import("../accounts/expense.model");
  const { BranchLedgerEntry } = await import("../accounts/branchLedger.model");
  if (
    (await IncomeEntry.exists({ branchId: id })) ||
    (await ExpenseEntry.exists({ branchId: id })) ||
    (await BranchLedgerEntry.exists({ branchId: id }))
  ) {
    throw ApiError.conflict("This branch has accounting history — it can't be deleted");
  }

  await doc.deleteOne();
  await recordAudit({ req, action: "branch.delete", module: "branches", targetCollection: "branches", targetId: id, before: doc.toObject() });
}
