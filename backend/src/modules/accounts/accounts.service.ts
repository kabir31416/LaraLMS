import { Request } from "express";
import { IncomeEntry, IncomeEntryDoc } from "./income.model";
import { ExpenseEntry, ExpenseEntryDoc } from "./expense.model";
import { AccountSettings, AccountSettingsDoc } from "./accountSettings.model";
import { ApiError } from "../../common/utils/ApiError";
import { recordAudit } from "../../audit/auditLog.service";
import { buildMeta, parsePagination } from "../../common/utils/pagination";
import { getOrCreateSingleton } from "../../common/utils/singleton";

function dateRangeFilter(req: Request): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  if (req.query.branchId) filter.branchId = req.query.branchId;
  if (req.query.method) filter.method = req.query.method;
  if (req.query.dateFrom || req.query.dateTo) {
    filter.date = {
      ...(req.query.dateFrom ? { $gte: req.query.dateFrom } : {}),
      ...(req.query.dateTo ? { $lte: req.query.dateTo } : {}),
    };
  }
  return filter;
}

export async function listIncome(req: Request) {
  const { page, limit, skip, sort } = parsePagination(req, { date: -1 });
  const filter = dateRangeFilter(req);
  const [items, total] = await Promise.all([
    IncomeEntry.find(filter).sort(sort).skip(skip).limit(limit),
    IncomeEntry.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

export async function createIncome(req: Request, data: Partial<IncomeEntryDoc>): Promise<IncomeEntryDoc> {
  const doc = await IncomeEntry.create(data);
  await recordAudit({ req, action: "income.create", module: "accounts", targetCollection: "incomeentries", targetId: String(doc._id), after: doc.toObject() });
  return doc;
}

/**
 * Auto-posts an income entry from another module's side effect (a Payment,
 * a book sale, ...). Same job the old client-side AccountsAutoBridge did by
 * watching the payments array — moved server-side so it fires exactly once,
 * atomically, at the moment the source event happens, regardless of whether
 * anyone has the Accounts page open. The (source, refId) unique index makes
 * a duplicate call a no-op rather than a double-posted income entry.
 */
export async function recordAutoIncome(data: {
  date: string;
  category: string;
  amount: number;
  branchId: string;
  method: IncomeEntryDoc["method"];
  studentId?: string;
  note?: string;
  source: IncomeEntryDoc["source"];
  refId: string;
}): Promise<void> {
  try {
    await IncomeEntry.create(data);
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code !== 11000) throw err; // duplicate (source, refId) — already posted, ignore
  }
}

async function getIncomeDocOrThrow(id: string): Promise<IncomeEntryDoc> {
  const doc = await IncomeEntry.findById(id);
  if (!doc) throw ApiError.notFound("Income entry not found");
  return doc;
}

export async function updateIncome(req: Request, id: string, patch: Partial<IncomeEntryDoc>): Promise<IncomeEntryDoc> {
  const doc = await getIncomeDocOrThrow(id);
  if (doc.source !== "manual") throw ApiError.conflict("Only manually-entered income can be edited");
  const before = doc.toObject();
  Object.assign(doc, patch);
  await doc.save();
  await recordAudit({ req, action: "income.update", module: "accounts", targetCollection: "incomeentries", targetId: id, before, after: doc.toObject() });
  return doc;
}

export async function deleteIncome(req: Request, id: string): Promise<void> {
  const doc = await getIncomeDocOrThrow(id);
  if (doc.source !== "manual") throw ApiError.conflict("Only manually-entered income can be deleted");
  await doc.deleteOne();
  await recordAudit({ req, action: "income.delete", module: "accounts", targetCollection: "incomeentries", targetId: id, before: doc.toObject() });
}

export async function listExpense(req: Request) {
  const { page, limit, skip, sort } = parsePagination(req, { date: -1 });
  const filter = dateRangeFilter(req);
  const [items, total] = await Promise.all([
    ExpenseEntry.find(filter).sort(sort).skip(skip).limit(limit),
    ExpenseEntry.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

async function getExpenseDocOrThrow(id: string): Promise<ExpenseEntryDoc> {
  const doc = await ExpenseEntry.findById(id);
  if (!doc) throw ApiError.notFound("Expense entry not found");
  return doc;
}

export async function createExpense(req: Request, data: Partial<ExpenseEntryDoc>): Promise<ExpenseEntryDoc> {
  const doc = await ExpenseEntry.create(data);
  await recordAudit({ req, action: "expense.create", module: "accounts", targetCollection: "expenseentries", targetId: String(doc._id), after: doc.toObject() });
  return doc;
}

export async function updateExpense(req: Request, id: string, patch: Partial<ExpenseEntryDoc>): Promise<ExpenseEntryDoc> {
  const doc = await getExpenseDocOrThrow(id);
  const before = doc.toObject();
  Object.assign(doc, patch);
  await doc.save();
  await recordAudit({ req, action: "expense.update", module: "accounts", targetCollection: "expenseentries", targetId: id, before, after: doc.toObject() });
  return doc;
}

export async function deleteExpense(req: Request, id: string): Promise<void> {
  const doc = await getExpenseDocOrThrow(id);
  await doc.deleteOne();
  await recordAudit({ req, action: "expense.delete", module: "accounts", targetCollection: "expenseentries", targetId: id, before: doc.toObject() });
}

const ACCOUNT_SETTINGS_DEFAULTS: Partial<AccountSettingsDoc> = {};

export async function getCategories(): Promise<AccountSettingsDoc> {
  return getOrCreateSingleton(AccountSettings, ACCOUNT_SETTINGS_DEFAULTS as AccountSettingsDoc);
}

export async function updateCategories(req: Request, patch: { incomeCategories?: string[]; expenseCategories?: string[] }): Promise<AccountSettingsDoc> {
  const doc = await getCategories();
  const before = doc.toObject();
  Object.assign(doc, patch);
  await doc.save();
  await recordAudit({ req, action: "accounts.update-categories", module: "accounts", targetCollection: "accountsettings", targetId: String(doc._id), before, after: doc.toObject() });
  return doc;
}
