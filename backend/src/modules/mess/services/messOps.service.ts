import { Request } from "express";
import { Types } from "mongoose";
import { ApiError } from "../../../common/utils/ApiError";
import { recordAudit } from "../../../audit/auditLog.service";
import { buildMeta, parsePagination } from "../../../common/utils/pagination";
import { generateSequenceCode } from "../../../common/utils/idGenerators";
import { mapWithConcurrency } from "../../../common/utils/concurrency";
import { env } from "../../../config/env";
import { PERMISSIONS } from "../../rbac/permissions";
import { Student } from "../../students/student.model";
import { Staff } from "../../staff/staff.model";
import { MessExpense, MessExpenseDoc } from "../models/messExpense.model";
import { MessComplaint, MessComplaintDoc } from "../models/messComplaint.model";
import { MessNotice, MessNoticeDoc } from "../models/messNotice.model";
import { MessMembership } from "../models/messMembership.model";
import { MessRoom } from "../models/messRoom.model";
import { assertMessAccess, hasPerm, messScopeFilter } from "../mess.scope";
import { actorId, todayISO, toObjectId } from "../mess.utils";
import { assertMessPaymentMethod, getMessSettings } from "./messSettings.service";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function dateRange(req: Request, field = "date"): Record<string, unknown> {
  if (!req.query.dateFrom && !req.query.dateTo) return {};
  return { [field]: { ...(req.query.dateFrom ? { $gte: String(req.query.dateFrom) } : {}), ...(req.query.dateTo ? { $lte: String(req.query.dateTo) } : {}) } };
}

// -------------------- Expenses --------------------

type ExpenseInput = Pick<MessExpenseDoc, "date" | "category" | "amount" | "method"> &
  Partial<Pick<MessExpenseDoc, "description" | "paidBy" | "vendor" | "invoiceNo" | "attachment">> & { messId: string; complaintId?: string };

export async function listExpenses(req: Request) {
  const { page, limit, skip } = parsePagination(req);
  const filter: Record<string, unknown> = { ...dateRange(req) };
  const scope = await messScopeFilter(req, req.query.messId);
  if (scope) filter.messId = scope;
  for (const key of ["category", "status", "method"] as const) {
    if (typeof req.query[key] === "string" && req.query[key]) filter[key] = req.query[key];
  }
  if (!filter.status) filter.status = { $ne: "cancelled" };
  if (typeof req.query.complaintId === "string" && Types.ObjectId.isValid(req.query.complaintId)) filter.complaintId = new Types.ObjectId(req.query.complaintId);
  if (typeof req.query.search === "string" && req.query.search.trim()) {
    const rx = new RegExp(escapeRegex(req.query.search.trim()), "i");
    filter.$or = [{ description: rx }, { vendor: rx }, { expenseNo: rx }, { invoiceNo: rx }];
  }
  const [items, total, byCategory] = await Promise.all([
    MessExpense.find(filter).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limit).populate("messId", "name code").populate("complaintId", "ticketNo title").lean(),
    MessExpense.countDocuments(filter),
    MessExpense.aggregate<{ _id: string; total: number; count: number }>([
      { $match: { ...filter, status: "approved" } },
      { $group: { _id: "$category", total: { $sum: "$amount" }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
  ]);
  return { items, meta: { ...buildMeta(page, limit, total), approvedTotal: byCategory.reduce((s, r) => s + r.total, 0), byCategory } };
}

async function getExpenseOrThrow(req: Request, id: string): Promise<MessExpenseDoc> {
  const e = await MessExpense.findById(toObjectId(id, "expenseId"));
  if (!e) throw ApiError.notFound("Expense not found");
  await assertMessAccess(req, e.messId);
  return e;
}

async function assertExpenseCategory(category: string) {
  const settings = await getMessSettings();
  if (!settings.expenseCategories.includes(category)) throw ApiError.badRequest("অজানা খরচের খাত — মেস সেটিংসে খাতটি যুক্ত করুন");
}

export async function createExpense(req: Request, input: ExpenseInput): Promise<MessExpenseDoc> {
  await assertMessAccess(req, input.messId);
  await assertExpenseCategory(input.category);
  await assertMessPaymentMethod(input.method);
  if (input.complaintId) {
    const c = await MessComplaint.findById(input.complaintId).select("messId");
    if (!c || String(c.messId) !== input.messId) throw ApiError.badRequest("রক্ষণাবেক্ষণ টিকিটটি এই মেসের নয়");
  }
  const settings = await getMessSettings();
  const autoApprove = !settings.expenseApprovalRequired || hasPerm(req, PERMISSIONS.MESS_EXPENSES_APPROVE);
  const doc = await MessExpense.create({
    ...input,
    expenseNo: await generateSequenceCode("mess_expense", "MEX", 5, true),
    status: autoApprove ? "approved" : "pending",
    addedBy: actorId(req),
    ...(autoApprove ? { approvedBy: actorId(req), approvedAt: new Date() } : {}),
  });
  await recordAudit({ req, action: "mess.expense.create", module: "mess", targetCollection: "messexpenses", targetId: String(doc._id), after: doc.toObject() });
  return doc;
}

export async function updateExpense(req: Request, id: string, patch: Partial<ExpenseInput>): Promise<MessExpenseDoc> {
  const e = await getExpenseOrThrow(req, id);
  const isApprover = hasPerm(req, PERMISSIONS.MESS_EXPENSES_APPROVE);
  if (e.status === "rejected" || e.status === "cancelled") throw ApiError.badRequest("বাতিল/প্রত্যাখ্যাত খরচ সম্পাদনা করা যাবে না");
  if (e.status === "approved" && !isApprover) throw ApiError.forbidden("অনুমোদিত খরচ শুধু অনুমোদনকারী সম্পাদনা করতে পারেন");
  if (patch.category) await assertExpenseCategory(patch.category);
  if (patch.method) await assertMessPaymentMethod(patch.method);
  const before = e.toObject();
  for (const key of ["date", "category", "amount", "method", "description", "paidBy", "vendor", "invoiceNo", "attachment"] as const) {
    if (patch[key] !== undefined) (e as unknown as Record<string, unknown>)[key] = patch[key];
  }
  await e.save();
  await recordAudit({ req, action: "mess.expense.update", module: "mess", targetCollection: "messexpenses", targetId: id, before, after: e.toObject() });
  return e;
}

export async function decideExpense(req: Request, id: string, decision: "approved" | "rejected" | "cancelled", reason?: string): Promise<MessExpenseDoc> {
  const e = await getExpenseOrThrow(req, id);
  const isApprover = hasPerm(req, PERMISSIONS.MESS_EXPENSES_APPROVE);
  const ownPending = e.status === "pending" && String(e.addedBy) === req.user?.id;
  if (decision === "cancelled" ? !(isApprover || ownPending) : !isApprover) throw ApiError.forbidden("খরচ অনুমোদন/বাতিলের অনুমতি আপনার নেই");
  const fromStatuses = decision === "cancelled" ? ["pending", "approved"] : ["pending"];
  const updated = await MessExpense.findOneAndUpdate(
    { _id: e._id, status: { $in: fromStatuses } },
    {
      $set: {
        status: decision,
        ...(decision === "approved" ? { approvedBy: actorId(req), approvedAt: new Date() } : {}),
        ...(reason ? { rejectedReason: reason } : {}),
      },
    },
    { new: true },
  );
  if (!updated) throw ApiError.badRequest("এই অবস্থা থেকে পরিবর্তন সম্ভব নয়");
  await recordAudit({ req, action: `mess.expense.${decision}`, module: "mess", targetCollection: "messexpenses", targetId: id, before: { status: e.status }, after: { status: decision, reason } });
  return updated;
}

// -------------------- Complaints & maintenance --------------------

export async function listComplaints(req: Request, studentOnly?: Types.ObjectId) {
  const { page, limit, skip } = parsePagination(req);
  const filter: Record<string, unknown> = {};
  if (studentOnly) {
    filter.studentId = studentOnly;
  } else {
    const scope = await messScopeFilter(req, req.query.messId);
    if (scope) filter.messId = scope;
  }
  for (const key of ["kind", "status", "priority", "category"] as const) {
    if (typeof req.query[key] === "string" && req.query[key]) filter[key] = req.query[key];
  }
  if (typeof req.query.assignedStaffId === "string" && Types.ObjectId.isValid(req.query.assignedStaffId)) filter.assignedStaffId = new Types.ObjectId(req.query.assignedStaffId);
  if (typeof req.query.search === "string" && req.query.search.trim()) {
    const rx = new RegExp(escapeRegex(req.query.search.trim()), "i");
    filter.$or = [{ title: rx }, { ticketNo: rx }, { description: rx }];
  }
  const [items, total] = await Promise.all([
    MessComplaint.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("messId", "name")
      .populate("roomId", "name")
      .populate("studentId", "name registrationId currentRollNumber")
      .populate("assignedStaffId", "name phone")
      .lean(),
    MessComplaint.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

async function getComplaintOrThrow(req: Request, id: string): Promise<MessComplaintDoc> {
  const c = await MessComplaint.findById(toObjectId(id, "complaintId"));
  if (!c) throw ApiError.notFound("Complaint not found");
  await assertMessAccess(req, c.messId);
  return c;
}

export async function getComplaint(req: Request, id: string) {
  const c = await getComplaintOrThrow(req, id);
  const [complaint, expenses] = await Promise.all([
    MessComplaint.findById(c._id).populate("messId", "name").populate("roomId", "name").populate("studentId", "name registrationId").populate("assignedStaffId", "name phone").lean(),
    MessExpense.find({ complaintId: c._id, status: { $ne: "cancelled" } }).select("expenseNo date amount status category").lean(),
  ]);
  return { complaint, expenses };
}

async function assertComplaintCategory(kind: "complaint" | "maintenance", category: string) {
  const settings = await getMessSettings();
  const list = kind === "maintenance" ? settings.maintenanceCategories : settings.complaintCategories;
  if (!list.includes(category)) throw ApiError.badRequest("অজানা ক্যাটাগরি");
}

export async function createComplaint(
  req: Request,
  input: { kind: "complaint" | "maintenance"; messId: string; roomId?: string; category: string; title: string; description?: string; priority?: MessComplaintDoc["priority"]; attachment?: MessComplaintDoc["attachment"]; assignedStaffId?: string; studentId?: string },
): Promise<MessComplaintDoc> {
  await assertMessAccess(req, input.messId);
  await assertComplaintCategory(input.kind, input.category);
  if (input.roomId) {
    const room = await MessRoom.findById(input.roomId).select("messId");
    if (!room || String(room.messId) !== input.messId) throw ApiError.badRequest("রুমটি এই মেসের নয়");
  }
  return insertComplaint(req, { ...input, date: todayISO() });
}

async function insertComplaint(req: Request, data: Record<string, unknown>): Promise<MessComplaintDoc> {
  const doc = await MessComplaint.create({
    ...data,
    ticketNo: await generateSequenceCode("mess_ticket", "MTK", 5, true),
    status: "open",
    submittedByUserId: actorId(req),
    submittedByRole: req.user?.role,
    history: [{ status: "open", at: new Date(), by: actorId(req), byRole: req.user?.role, note: "তৈরি" }],
  });
  await recordAudit({ req, action: "mess.complaint.create", module: "mess", targetCollection: "messcomplaints", targetId: String(doc._id), after: doc.toObject() });
  return doc;
}

export async function updateComplaint(
  req: Request,
  id: string,
  patch: { status?: MessComplaintDoc["status"]; priority?: MessComplaintDoc["priority"]; assignedStaffId?: string | null; note?: string },
): Promise<MessComplaintDoc> {
  const c = await getComplaintOrThrow(req, id);
  const set: Record<string, unknown> = {};
  const unset: Record<string, ""> = {};
  if (patch.status) {
    set.status = patch.status;
    if (patch.status === "resolved" || patch.status === "closed") set.resolvedAt = new Date();
  }
  if (patch.priority) set.priority = patch.priority;
  if (patch.assignedStaffId === null) unset.assignedStaffId = "";
  else if (patch.assignedStaffId) {
    if (!(await Staff.exists({ _id: patch.assignedStaffId }))) throw ApiError.badRequest("Staff not found");
    set.assignedStaffId = new Types.ObjectId(patch.assignedStaffId);
  }
  const updated = await MessComplaint.findByIdAndUpdate(
    c._id,
    {
      ...(Object.keys(set).length ? { $set: set } : {}),
      ...(Object.keys(unset).length ? { $unset: unset } : {}),
      $push: { history: { status: patch.status ?? c.status, at: new Date(), by: actorId(req), byRole: req.user?.role, note: patch.note } },
    },
    { new: true },
  );
  await recordAudit({ req, action: "mess.complaint.update", module: "mess", targetCollection: "messcomplaints", targetId: id, before: { status: c.status, priority: c.priority, assignedStaffId: c.assignedStaffId }, after: { ...set, note: patch.note } });
  return updated!;
}

// -------------------- Notices --------------------

export async function listNotices(req: Request) {
  const { page, limit, skip } = parsePagination(req, { publishDate: -1, createdAt: -1 });
  const filter: Record<string, unknown> = {};
  const scope = await messScopeFilter(req, req.query.messId);
  if (scope) filter.messId = scope;
  for (const key of ["type", "status", "audience"] as const) {
    if (typeof req.query[key] === "string" && req.query[key]) filter[key] = req.query[key];
  }
  const [items, total] = await Promise.all([
    MessNotice.find(filter).sort({ publishDate: -1, createdAt: -1 }).skip(skip).limit(limit).populate("messId", "name").populate("studentId", "name registrationId").lean(),
    MessNotice.countDocuments(filter),
  ]);
  return { items: items.map((n) => ({ ...n, readCount: n.readBy?.length ?? 0, readBy: undefined })), meta: buildMeta(page, limit, total) };
}

async function noticeRecipients(notice: MessNoticeDoc): Promise<{ studentId: Types.ObjectId; phone: string }[]> {
  const studentIds = notice.audience === "member" && notice.studentId
    ? [notice.studentId]
    : ((await MessMembership.find({ messId: notice.messId, status: { $in: ["approved", "active", "on_leave", "notice_given"] } }).distinct("studentId")) as Types.ObjectId[]);
  const students = await Student.find({ _id: { $in: studentIds } }).select("phone").lean();
  return students.filter((s) => s.phone).map((s) => ({ studentId: s._id as Types.ObjectId, phone: s.phone }));
}

export async function createNotice(
  req: Request,
  input: { messId: string; audience: "mess" | "member"; membershipId?: string; type: MessNoticeDoc["type"]; title: string; body: string; publishDate?: string; expiryDate?: string; sendSms?: boolean },
): Promise<MessNoticeDoc> {
  await assertMessAccess(req, input.messId);
  let studentId: Types.ObjectId | undefined;
  if (input.audience === "member") {
    if (!input.membershipId) throw ApiError.badRequest("সদস্য নির্বাচন করুন");
    const m = await MessMembership.findById(input.membershipId).select("messId studentId");
    if (!m || String(m.messId) !== input.messId) throw ApiError.badRequest("সদস্যটি এই মেসের নয়");
    studentId = m.studentId;
  }
  const notice = await MessNotice.create({
    messId: input.messId,
    audience: input.audience,
    membershipId: input.audience === "member" ? input.membershipId : undefined,
    studentId,
    type: input.type,
    title: input.title,
    body: input.body,
    publishDate: input.publishDate || todayISO(),
    expiryDate: input.expiryDate,
    status: "active",
    sms: { requested: !!input.sendSms, recipients: 0, sent: 0, failed: 0 },
    createdBy: actorId(req),
  });
  await recordAudit({ req, action: "mess.notice.create", module: "mess", targetCollection: "messnotices", targetId: String(notice._id), after: notice.toObject() });

  if (input.sendSms) {
    // Notices carry no money, so the bounded-concurrency send is awaited here
    // (works the same on serverless). sendSms never throws.
    const { sendSms } = await import("../../sms/sms.service");
    const recipients = await noticeRecipients(notice);
    const text = `${input.title}: ${input.body}`.slice(0, 480);
    const results = await mapWithConcurrency(recipients, env.SMS_BULK_CONCURRENCY, (r) =>
      sendSms({ to: r.phone, message: text, eventType: "mess", studentId: String(r.studentId) }),
    );
    const sent = results.filter((r) => r.ok).length;
    await MessNotice.updateOne({ _id: notice._id }, { $set: { sms: { requested: true, recipients: recipients.length, sent, failed: recipients.length - sent, finishedAt: new Date() } } });
    notice.sms = { requested: true, recipients: recipients.length, sent, failed: recipients.length - sent, finishedAt: new Date() };
  }
  return notice;
}

export async function updateNotice(req: Request, id: string, patch: Partial<Pick<MessNoticeDoc, "title" | "body" | "type" | "publishDate" | "expiryDate" | "status">>): Promise<MessNoticeDoc> {
  const n = await MessNotice.findById(toObjectId(id, "noticeId"));
  if (!n) throw ApiError.notFound("Notice not found");
  await assertMessAccess(req, n.messId);
  const before = n.toObject();
  for (const key of ["title", "body", "type", "publishDate", "expiryDate", "status"] as const) {
    if (patch[key] !== undefined) (n as unknown as Record<string, unknown>)[key] = patch[key];
  }
  await n.save();
  await recordAudit({ req, action: "mess.notice.update", module: "mess", targetCollection: "messnotices", targetId: id, before: { ...before, readBy: undefined }, after: { ...n.toObject(), readBy: undefined } });
  return n;
}

export { insertComplaint, assertComplaintCategory };
