import { Request } from "express";
import { Book, BookDoc } from "./book.model";
import { BranchStock } from "./branchStock.model";
import { BookIssue } from "./bookIssue.model";
import { StockHistory } from "./stockHistory.model";
import { STOCK_HISTORY_ACTIONS } from "./book.constants";
import { Student } from "../students/student.model";
import { PERMISSIONS } from "../rbac/permissions";
import { ApiError } from "../../common/utils/ApiError";
import { recordAudit } from "../../audit/auditLog.service";
import { buildMeta, buildSearchFilter, parsePagination } from "../../common/utils/pagination";
import { generateBookCode } from "../../common/utils/idGenerators";

async function pushHistory(entry: {
  action: (typeof STOCK_HISTORY_ACTIONS)[number];
  bookId: string;
  bookName: string;
  quantity: number;
  branchId?: string;
  branchName?: string;
  studentId?: string;
  studentName?: string;
  note?: string;
}) {
  await StockHistory.create(entry);
}

function hasBroadAccess(req: Request): boolean {
  const perms = req.user!.permissions;
  return perms.includes("*") || perms.includes(PERMISSIONS.BOOKS_MANAGE);
}

export async function list(req: Request) {
  const { page, limit, skip, sort } = parsePagination(req, { createdAt: -1 });
  const filter: Record<string, unknown> = { ...buildSearchFilter(req.query.search, ["name", "bookCode"]) };
  if (req.query.subject) filter.subject = req.query.subject;
  if (req.query.class) filter.class = req.query.class;
  if (req.query.lowStockOnly === "true") filter.$expr = { $lte: ["$totalStock", "$lowStockThreshold"] };

  const [items, total] = await Promise.all([
    Book.find(filter).sort(sort).skip(skip).limit(limit),
    Book.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

async function getDocOrThrow(id: string): Promise<BookDoc> {
  const doc = await Book.findById(id);
  if (!doc) throw ApiError.notFound("Book not found");
  return doc;
}

export async function create(req: Request, data: Partial<BookDoc>): Promise<BookDoc> {
  const bookCode = await generateBookCode();
  const doc = await Book.create({ ...data, bookCode });
  await recordAudit({ req, action: "book.create", module: "books", targetCollection: "books", targetId: String(doc._id), after: doc.toObject() });
  return doc;
}

export async function update(req: Request, id: string, patch: Partial<BookDoc>): Promise<BookDoc> {
  const doc = await getDocOrThrow(id);
  const before = doc.toObject();
  Object.assign(doc, patch);
  await doc.save();
  await recordAudit({ req, action: "book.update", module: "books", targetCollection: "books", targetId: id, before, after: doc.toObject() });
  return doc;
}

export async function remove(req: Request, id: string): Promise<void> {
  const doc = await getDocOrThrow(id);
  if (await BranchStock.exists({ bookId: id, quantity: { $gt: 0 } })) {
    throw ApiError.conflict("This book still has stock at a branch — transfer or clear it first");
  }
  if (await BookIssue.exists({ bookId: id, $expr: { $lt: ["$returnedQuantity", "$quantity"] } })) {
    throw ApiError.conflict("This book still has unreturned copies issued to students");
  }
  await doc.deleteOne();
  await recordAudit({ req, action: "book.delete", module: "books", targetCollection: "books", targetId: id, before: doc.toObject() });
}

export async function adjustStock(req: Request, id: string, action: "add" | "reduce", quantity: number, note?: string): Promise<BookDoc> {
  const doc = await getDocOrThrow(id);
  if (action === "reduce" && quantity > doc.totalStock) {
    throw ApiError.badRequest("Cannot reduce more than the current main stock");
  }
  doc.totalStock = action === "add" ? doc.totalStock + quantity : doc.totalStock - quantity;
  await doc.save();
  await pushHistory({
    action: action === "add" ? "স্টক যোগ" : "স্টক কমানো",
    bookId: id,
    bookName: doc.name,
    quantity,
    note,
  });
  await recordAudit({ req, action: `book.stock-${action}`, module: "books", targetCollection: "books", targetId: id, after: { totalStock: doc.totalStock } });
  return doc;
}

export async function listBranchStock(req: Request) {
  const { page, limit, skip } = parsePagination(req, { createdAt: -1 });
  const filter: Record<string, unknown> = {};
  if (req.query.branchId) filter.branchId = req.query.branchId;

  const [items, total] = await Promise.all([
    BranchStock.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    BranchStock.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

/**
 * Multi-book transfer to a branch. All-or-nothing per item, not per call —
 * items that fail (book missing or insufficient stock) are reported back
 * rather than failing the whole request, matching the existing UI's
 * "some books transferred, here's what didn't" flow.
 */
export async function transferToBranch(
  req: Request,
  branchId: string,
  items: { bookId: string; quantity: number }[],
): Promise<{ ok: boolean; failed?: string[] }> {
  const failed: string[] = [];
  const valid: { bookId: string; quantity: number; book: BookDoc }[] = [];

  for (const item of items) {
    const book = await Book.findById(item.bookId);
    if (!book || item.quantity <= 0 || book.totalStock < item.quantity) {
      if (book) failed.push(book.name);
      continue;
    }
    valid.push({ ...item, book });
  }
  if (valid.length === 0) return { ok: false, failed: failed.length ? failed : undefined };

  for (const item of valid) {
    item.book.totalStock -= item.quantity;
    await item.book.save();
    await BranchStock.findOneAndUpdate(
      { branchId, bookId: item.bookId },
      { $inc: { quantity: item.quantity } },
      { upsert: true },
    );
    await pushHistory({
      action: "ব্রাঞ্চে স্থানান্তর",
      bookId: item.bookId,
      bookName: item.book.name,
      branchId,
      quantity: item.quantity,
    });
  }

  await recordAudit({
    req,
    action: "book.transfer-to-branch",
    module: "books",
    targetCollection: "branchstocks",
    targetId: branchId,
    after: { branchId, items: valid.map((v) => ({ bookId: v.bookId, quantity: v.quantity })) },
  });
  return { ok: true, failed: failed.length ? failed : undefined };
}

export async function listIssues(req: Request) {
  if (!hasBroadAccess(req)) {
    if (!req.user!.studentId) throw ApiError.forbidden("No linked student record");
    req.query.studentId = req.user!.studentId;
  }

  const { page, limit, skip, sort } = parsePagination(req, { createdAt: -1 });
  const filter: Record<string, unknown> = {};
  if (req.query.studentId) filter.studentId = req.query.studentId;

  const [items, total] = await Promise.all([
    BookIssue.find(filter).sort(sort).skip(skip).limit(limit),
    BookIssue.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

/** Multi-book issue to a student, straight from main stock. Same partial-success shape as transferToBranch. */
export async function issueToStudent(
  req: Request,
  studentId: string,
  issueDate: string,
  items: { bookId: string; quantity: number }[],
): Promise<{ ok: boolean; failed?: string[] }> {
  const student = await Student.findById(studentId);
  if (!student) throw ApiError.notFound("Student not found");

  const failed: string[] = [];
  const valid: { bookId: string; quantity: number; book: BookDoc }[] = [];
  for (const item of items) {
    const book = await Book.findById(item.bookId);
    if (!book || item.quantity <= 0 || book.totalStock < item.quantity) {
      if (book) failed.push(book.name);
      continue;
    }
    valid.push({ ...item, book });
  }
  if (valid.length === 0) return { ok: false, failed: failed.length ? failed : undefined };

  for (const item of valid) {
    item.book.totalStock -= item.quantity;
    await item.book.save();
    await BookIssue.create({
      studentId,
      bookId: item.bookId,
      quantity: item.quantity,
      issueDate,
      returnedQuantity: 0,
      status: "ইস্যু",
    });
    await pushHistory({
      action: "শিক্ষার্থীকে বিতরণ",
      bookId: item.bookId,
      bookName: item.book.name,
      studentId,
      studentName: student.name,
      quantity: item.quantity,
    });
  }

  await recordAudit({
    req,
    action: "book.issue-to-student",
    module: "books",
    targetCollection: "bookissues",
    targetId: studentId,
    after: { studentId, items: valid.map((v) => ({ bookId: v.bookId, quantity: v.quantity })) },
  });
  return { ok: true, failed: failed.length ? failed : undefined };
}

export async function returnFromStudent(req: Request, issueId: string, quantity: number): Promise<void> {
  const issue = await BookIssue.findById(issueId);
  if (!issue) throw ApiError.notFound("Issue record not found");
  const remaining = issue.quantity - issue.returnedQuantity;
  if (quantity <= 0 || quantity > remaining) throw ApiError.badRequest("Invalid return quantity");

  const book = await getDocOrThrow(String(issue.bookId));

  issue.returnedQuantity += quantity;
  issue.status = issue.returnedQuantity >= issue.quantity ? "ফেরত" : "আংশিক ফেরত";
  await issue.save();

  book.totalStock += quantity;
  await book.save();

  await pushHistory({
    action: "শিক্ষার্থী থেকে ফেরত",
    bookId: String(issue.bookId),
    bookName: book.name,
    studentId: String(issue.studentId),
    quantity,
  });

  await recordAudit({ req, action: "book.return-from-student", module: "books", targetCollection: "bookissues", targetId: issueId, after: { returnedQuantity: issue.returnedQuantity, status: issue.status } });
}

export async function listHistory(req: Request) {
  const { page, limit, skip } = parsePagination(req, { createdAt: -1 });
  const filter: Record<string, unknown> = {};
  if (req.query.action) filter.action = req.query.action;

  const [items, total] = await Promise.all([
    StockHistory.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    StockHistory.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}
