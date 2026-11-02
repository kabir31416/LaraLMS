import { Request } from "express";
import { Types } from "mongoose";
import { ApiError } from "../../../common/utils/ApiError";
import { recordAudit } from "../../../audit/auditLog.service";
import { buildMeta, parsePagination } from "../../../common/utils/pagination";
import { generateSequenceCode } from "../../../common/utils/idGenerators";
import { PERMISSIONS } from "../../rbac/permissions";
import { Student } from "../../students/student.model";
import { Mess } from "../models/mess.model";
import { MessSeat, MessSeatDoc } from "../models/messSeat.model";
import { MessMembership, MessMembershipDoc } from "../models/messMembership.model";
import { MessReservation, MessReservationDoc } from "../models/messReservation.model";
import { MessBill } from "../models/messBill.model";
import { MessPayment } from "../models/messPayment.model";
import { MessDepositTransaction } from "../models/messDepositTransaction.model";
import { MessSettlement } from "../models/messSettlement.model";
import { assertMessAccess, hasPerm, messScopeFilter } from "../mess.scope";
import { MembershipStatus, OCCUPYING_STATUS } from "../mess.constants";
import { actorId, isDuplicateKeyError, statusFlags, todayISO, toObjectId } from "../mess.utils";
import { claimSeat, releaseSeat } from "./messSetup.service";
import { getMessSettings } from "./messSettings.service";
import { recomputeLedger } from "./messLedger.service";

const STUDENT_FIELDS = "name registrationId currentRollNumber phone photoUrl course courseId currentBatchId status";

function assertCanApprove(req: Request) {
  if (!hasPerm(req, PERMISSIONS.MESS_MEMBERS_APPROVE)) throw ApiError.forbidden("সদস্যপদ অনুমোদনের অনুমতি আপনার নেই");
}

async function assertDiscountAllowed(req: Request, discount: number | undefined) {
  if (!discount || discount <= 0) return;
  const settings = await getMessSettings();
  if (settings.discountApprovalRequired && !hasPerm(req, PERMISSIONS.MESS_FINANCE_APPROVE)) {
    throw ApiError.forbidden("মেস সেটিংস অনুযায়ী ডিসকাউন্ট দিতে আর্থিক অনুমোদনের অনুমতি প্রয়োজন");
  }
}

async function getStudentOrThrow(studentId: string | Types.ObjectId) {
  const student = await Student.findById(studentId).select(`${STUDENT_FIELDS} admissionStatus`);
  if (!student) throw ApiError.notFound("Student not found");
  if (student.admissionStatus === "pending" || student.admissionStatus === "rejected") {
    throw ApiError.badRequest("এই শিক্ষার্থীর ভর্তি এখনো অনুমোদিত হয়নি — অনুমোদিত শিক্ষার্থীকেই মেসে যুক্ত করা যাবে");
  }
  return student;
}

async function assertNoOpenMembership(studentId: Types.ObjectId, exceptId?: Types.ObjectId) {
  const existing = await MessMembership.findOne({ studentId, isOpen: true, ...(exceptId ? { _id: { $ne: exceptId } } : {}) }).select("membershipNo status");
  if (existing) {
    throw ApiError.conflict(`এই শিক্ষার্থীর ইতিমধ্যে একটি চলমান মেস সদস্যপদ/আবেদন আছে (${existing.membershipNo}) — নতুন সদস্যপদ তৈরি করা যাবে না`);
  }
}

async function loadSeatForMess(seatId: string, messId: Types.ObjectId): Promise<MessSeatDoc> {
  const seat = await MessSeat.findById(seatId);
  if (!seat) throw ApiError.notFound("Seat not found");
  if (String(seat.messId) !== String(messId)) throw ApiError.badRequest("সিটটি নির্বাচিত মেসের নয়");
  return seat;
}

export async function getMembershipOrThrow(req: Request, id: string): Promise<MessMembershipDoc> {
  const m = await MessMembership.findById(toObjectId(id, "membershipId"));
  if (!m) throw ApiError.notFound("Membership not found");
  await assertMessAccess(req, m.messId);
  return m;
}

// -------------------- Student search (existing Student DB only) --------------------

export async function searchStudents(req: Request) {
  const { buildSearchFilterWithGuardian } = await import("../../students/student.service");
  const filter: Record<string, unknown> = { admissionStatus: { $nin: ["pending", "rejected"] } };
  if (typeof req.query.courseId === "string" && Types.ObjectId.isValid(req.query.courseId)) filter.courseId = new Types.ObjectId(req.query.courseId);
  if (typeof req.query.batchId === "string" && Types.ObjectId.isValid(req.query.batchId)) filter.currentBatchId = new Types.ObjectId(req.query.batchId);
  const search = typeof req.query.search === "string" ? req.query.search : "";
  if (!search.trim() && !filter.courseId && !filter.currentBatchId) return [];
  Object.assign(filter, await buildSearchFilterWithGuardian(search));
  const students = await Student.find(filter).select(STUDENT_FIELDS).sort({ name: 1 }).limit(20).populate("currentBatchId", "name").lean();
  if (students.length === 0) return [];
  const ids = students.map((s) => s._id);
  const { Guardian } = await import("../../guardians/guardian.model");
  const [open, reservations, guardians] = await Promise.all([
    MessMembership.find({ studentId: { $in: ids }, isOpen: true }).select("studentId membershipNo status messId").populate("messId", "name").lean(),
    MessReservation.find({ studentId: { $in: ids }, isActive: true }).select("studentId reservationNo messId seatId").lean(),
    Guardian.find({ studentId: { $in: ids } }).sort({ isPrimary: -1 }).select("studentId name phone relation").lean(),
  ]);
  return students.map((s) => ({
    ...s,
    guardian: guardians.find((g) => String(g.studentId) === String(s._id)) ?? null,
    openMembership: open.find((m) => String(m.studentId) === String(s._id)) ?? null,
    activeReservation: reservations.find((r) => String(r.studentId) === String(s._id)) ?? null,
  }));
}

// -------------------- Admission / application --------------------

export interface CreateMembershipInput {
  studentId: string;
  messId: string;
  seatId: string;
  joiningDate: string;
  expectedLeavingDate?: string;
  monthlyRent?: number;
  securityDeposit?: number;
  discount?: number;
  setupCharge?: number;
  billingStartDate?: string;
  emergencyContact?: { name?: string; phone?: string; relation?: string };
  notes?: string;
  documents?: { label: string; url: string; publicId?: string }[];
  initialStatus?: "pending" | "approved" | "active";
  reservationId?: string;
}

export async function createMembership(req: Request, input: CreateMembershipInput): Promise<MessMembershipDoc> {
  const messId = toObjectId(input.messId, "messId");
  await assertMessAccess(req, messId);
  const mess = await Mess.findById(messId);
  if (!mess) throw ApiError.notFound("Mess not found");
  if (mess.status !== "active") throw ApiError.badRequest("এই মেসটি নিষ্ক্রিয় — নতুন সদস্য যোগ করা যাবে না");
  const student = await getStudentOrThrow(input.studentId);
  const initialStatus = input.initialStatus ?? "pending";
  if (initialStatus !== "pending") assertCanApprove(req);
  await assertDiscountAllowed(req, input.discount);
  await assertNoOpenMembership(student._id as Types.ObjectId);

  let reservation: MessReservationDoc | null = null;
  if (input.reservationId) {
    // The reserved seat passes straight to the membership, so the membership
    // must hold it from the start — a "pending" application doesn't hold a
    // seat, and would leave the seat stuck on a converted reservation.
    if (initialStatus === "pending") {
      throw ApiError.badRequest("রিজার্ভেশন থেকে ভর্তির সময় অবস্থা 'অনুমোদিত' বা 'সক্রিয়' নির্বাচন করুন");
    }
    reservation = await MessReservation.findById(input.reservationId);
    if (!reservation || reservation.status !== "active") throw ApiError.badRequest("রিজার্ভেশনটি সক্রিয় নেই");
    if (String(reservation.studentId) !== String(student._id)) throw ApiError.badRequest("রিজার্ভেশনটি এই শিক্ষার্থীর নয়");
    if (String(reservation.seatId) !== input.seatId) throw ApiError.badRequest("রিজার্ভেশনের সিট ও নির্বাচিত সিট এক নয়");
  } else {
    const otherReservation = await MessReservation.findOne({ studentId: student._id, isActive: true }).select("reservationNo");
    if (otherReservation) {
      throw ApiError.conflict(`এই শিক্ষার্থীর একটি সক্রিয় রিজার্ভেশন আছে (${otherReservation.reservationNo}) — সেটি থেকে সদস্যপদ তৈরি করুন বা আগে বাতিল করুন`);
    }
  }

  const seat = await loadSeatForMess(input.seatId, messId);
  const settings = await getMessSettings();
  const membershipId = new Types.ObjectId();
  const flags = statusFlags(initialStatus);
  const joiningDate = input.joiningDate;

  // Seat first (atomic), membership second, compensate on failure — there
  // are no multi-document transactions to lean on.
  let seatClaimed = false;
  if (flags.holdsSeat) {
    await claimSeat(
      seat._id as Types.ObjectId,
      { membershipId, studentId: student._id as Types.ObjectId },
      OCCUPYING_STATUS.includes(initialStatus) ? "occupied" : "reserved",
      reservation ? { fromReservationId: reservation._id as Types.ObjectId } : {},
    );
    seatClaimed = true;
  }

  const monthlyRent = input.monthlyRent ?? seat.monthlyRent ?? settings.defaultRent;
  let doc: MessMembershipDoc;
  try {
    doc = await MessMembership.create({
      _id: membershipId,
      membershipNo: await generateSequenceCode("mess_membership", "MM", 5),
      studentId: student._id,
      messId,
      roomId: seat.roomId,
      seatId: seat._id,
      reservationId: reservation?._id,
      joiningDate,
      expectedLeavingDate: input.expectedLeavingDate,
      monthlyRent,
      discount: input.discount ?? 0,
      securityDeposit: input.securityDeposit ?? settings.defaultDeposit,
      setupCharge: input.setupCharge ?? 0,
      billingStartDate: input.billingStartDate || joiningDate,
      emergencyContact: input.emergencyContact,
      notes: input.notes,
      documents: input.documents ?? [],
      status: initialStatus,
      ...flags,
      seatHistory: OCCUPYING_STATUS.includes(initialStatus)
        ? [{ messId, roomId: seat.roomId, seatId: seat._id, fromDate: joiningDate, monthlyRent, reason: "ভর্তি", changedBy: actorId(req) }]
        : [],
      statusHistory: [{ status: initialStatus, at: new Date(), by: actorId(req), note: reservation ? `রিজার্ভেশন ${reservation.reservationNo} থেকে` : undefined }],
      createdBy: actorId(req),
    });
  } catch (err) {
    if (seatClaimed) {
      if (reservation) {
        // Hand the seat back to the reservation exactly as it was.
        await MessSeat.updateOne(
          { _id: seat._id, currentMembershipId: membershipId },
          { $set: { status: "reserved", currentReservationId: reservation._id, currentStudentId: student._id }, $unset: { currentMembershipId: "" } },
        );
      } else {
        await releaseSeat(seat._id as Types.ObjectId, { membershipId });
      }
    }
    if (isDuplicateKeyError(err)) throw ApiError.conflict("এই শিক্ষার্থীর ইতিমধ্যে একটি চলমান সদস্যপদ আছে, অথবা সিটটি অন্য কেউ নিয়েছেন");
    throw err;
  }

  if (reservation) {
    await MessReservation.updateOne({ _id: reservation._id, status: "active" }, { $set: { status: "converted", isActive: false, membershipId: doc._id } });
    // Advance money taken at reservation time now counts on the member's ledger.
    await MessPayment.updateMany({ reservationId: reservation._id, membershipId: { $exists: false } }, { $set: { membershipId: doc._id } });
  }
  await recomputeLedger(doc._id as Types.ObjectId);
  await recordAudit({ req, action: "mess.membership.create", module: "mess", targetCollection: "messmemberships", targetId: String(doc._id), after: doc.toObject() });
  return doc;
}

// -------------------- Lifecycle transitions --------------------

async function transition(
  req: Request,
  m: MessMembershipDoc,
  to: MembershipStatus,
  extra: Record<string, unknown> = {},
  note?: string,
  push: Record<string, unknown> = {},
): Promise<MessMembershipDoc> {
  const from = m.status;
  const updated = await MessMembership.findOneAndUpdate(
    { _id: m._id, status: from },
    {
      $set: { status: to, ...statusFlags(to), ...extra },
      $push: { statusHistory: { status: to, at: new Date(), by: actorId(req), note }, ...push },
    },
    { new: true },
  );
  if (!updated) throw ApiError.conflict("সদস্যপদের অবস্থা ইতিমধ্যে পরিবর্তিত হয়েছে — পেজ রিফ্রেশ করে আবার চেষ্টা করুন");
  await recordAudit({
    req,
    action: `mess.membership.${to}`,
    module: "mess",
    targetCollection: "messmemberships",
    targetId: String(m._id),
    before: { status: from },
    after: { status: to, ...extra, note },
  });
  return updated;
}

/** Pending → Approved: the seat is reserved for the member (optionally a different seat than requested). */
export async function approveMembership(req: Request, id: string, body: { seatId?: string; note?: string }): Promise<MessMembershipDoc> {
  assertCanApprove(req);
  const m = await getMembershipOrThrow(req, id);
  if (m.status !== "pending") throw ApiError.badRequest("শুধু অপেক্ষমাণ আবেদন অনুমোদন করা যায়");
  const seat = body.seatId ? await loadSeatForMess(body.seatId, m.messId) : await loadSeatForMess(String(m.seatId), m.messId);
  await claimSeat(seat._id as Types.ObjectId, { membershipId: m._id as Types.ObjectId, studentId: m.studentId }, "reserved");
  try {
    return await transition(req, m, "approved", { seatId: seat._id, roomId: seat.roomId }, body.note);
  } catch (err) {
    await releaseSeat(seat._id as Types.ObjectId, { membershipId: m._id as Types.ObjectId });
    if (isDuplicateKeyError(err)) throw ApiError.conflict("সিটটি অন্য একজন সদস্যের কাছে আছে");
    throw err;
  }
}

export async function rejectMembership(req: Request, id: string, reason: string): Promise<MessMembershipDoc> {
  assertCanApprove(req);
  const m = await getMembershipOrThrow(req, id);
  if (m.status !== "pending") throw ApiError.badRequest("শুধু অপেক্ষমাণ আবেদন প্রত্যাখ্যান করা যায়");
  return transition(req, m, "cancelled", { cancelReason: `আবেদন প্রত্যাখ্যাত: ${reason}` }, reason);
}

/** Approved (or Pending) → Active: the member moves in and billing can start. */
export async function activateMembership(req: Request, id: string, body: { joiningDate?: string; billingStartDate?: string; note?: string }): Promise<MessMembershipDoc> {
  assertCanApprove(req);
  const m = await getMembershipOrThrow(req, id);
  if (m.status !== "approved" && m.status !== "pending") throw ApiError.badRequest("শুধু অনুমোদিত/অপেক্ষমাণ সদস্যপদ সক্রিয় করা যায়");
  const joiningDate = body.joiningDate || m.joiningDate;
  const mid = m._id as Types.ObjectId;
  if (m.status === "approved") {
    await claimSeat(m.seatId, { membershipId: mid, studentId: m.studentId }, "occupied", { fromMembershipId: mid });
  } else {
    await claimSeat(m.seatId, { membershipId: mid, studentId: m.studentId }, "occupied");
  }
  try {
    const updated = await transition(
      req,
      m,
      "active",
      {
        joiningDate,
        billingStartDate: body.billingStartDate || (m.billingStartDate < joiningDate ? joiningDate : m.billingStartDate),
      },
      body.note,
      { seatHistory: { messId: m.messId, roomId: m.roomId, seatId: m.seatId, fromDate: joiningDate, monthlyRent: m.monthlyRent, reason: "সক্রিয়করণ", changedBy: actorId(req) } },
    );
    return updated;
  } catch (err) {
    if (m.status === "pending") await releaseSeat(m.seatId, { membershipId: mid });
    else await MessSeat.updateOne({ _id: m.seatId, currentMembershipId: mid }, { $set: { status: "reserved" } });
    throw err;
  }
}

/** Active ↔ On Leave ↔ Notice Given. Leaving itself goes through the final settlement. */
export async function changeStatus(req: Request, id: string, body: { status: "active" | "on_leave" | "notice_given"; expectedLeavingDate?: string; note?: string }): Promise<MessMembershipDoc> {
  const m = await getMembershipOrThrow(req, id);
  const allowed: Record<string, MembershipStatus[]> = {
    active: ["on_leave", "notice_given"],
    on_leave: ["active", "notice_given"],
    notice_given: ["active", "on_leave"],
  };
  if (!allowed[m.status]?.includes(body.status)) throw ApiError.badRequest("এই অবস্থা পরিবর্তন অনুমোদিত নয়");
  const extra: Record<string, unknown> = {};
  if (body.status === "notice_given") {
    if (!body.expectedLeavingDate) throw ApiError.badRequest("নোটিশ দেওয়ার ক্ষেত্রে সম্ভাব্য ছাড়ার তারিখ দিন");
    extra.expectedLeavingDate = body.expectedLeavingDate;
  }
  return transition(req, m, body.status, extra, body.note);
}

/** Cancel an application/approval, or a membership that never had any money attached. Anything financial leaves through settlement. */
export async function cancelMembership(req: Request, id: string, reason: string): Promise<MessMembershipDoc> {
  const m = await getMembershipOrThrow(req, id);
  if (!["pending", "approved", "active", "on_leave", "notice_given"].includes(m.status)) throw ApiError.badRequest("এই সদস্যপদ বাতিল করা যাবে না");
  if (m.status !== "pending") assertCanApprove(req);
  const [bills, payments, depositTx] = await Promise.all([
    MessBill.exists({ membershipId: m._id, status: { $ne: "cancelled" } }),
    MessPayment.exists({ membershipId: m._id, status: "active" }),
    MessDepositTransaction.exists({ membershipId: m._id, status: { $nin: ["rejected", "cancelled"] } }),
  ]);
  if (bills || payments || depositTx) {
    throw ApiError.conflict("এই সদস্যপদে বিল/পেমেন্ট আছে — বাতিল নয়, চূড়ান্ত হিসাব নিষ্পত্তি (Settlement) করে সদস্যপদ শেষ করুন");
  }
  const updated = await transition(req, m, "cancelled", { cancelReason: reason, leftDate: m.status === "pending" || m.status === "approved" ? undefined : todayISO() }, reason);
  if (m.holdsSeat) await releaseSeat(m.seatId, { membershipId: m._id as Types.ObjectId });
  return updated;
}

/** Moves a seat-holding member to another available seat (any accessible Mess). Seat history keeps both. */
export async function transferSeat(
  req: Request,
  id: string,
  body: { seatId: string; effectiveDate?: string; monthlyRent?: number; reason?: string },
): Promise<MessMembershipDoc> {
  const m = await getMembershipOrThrow(req, id);
  if (!m.holdsSeat) throw ApiError.badRequest("শুধু সিটধারী সদস্যকে স্থানান্তর করা যায়");
  if (body.seatId === String(m.seatId)) throw ApiError.badRequest("নতুন সিট বর্তমান সিটের মতোই");
  const newSeat = await MessSeat.findById(body.seatId);
  if (!newSeat) throw ApiError.notFound("Seat not found");
  await assertMessAccess(req, newSeat.messId);
  const mid = m._id as Types.ObjectId;
  const oldSeatId = m.seatId;
  const effectiveDate = body.effectiveDate || todayISO();
  const occupying = OCCUPYING_STATUS.includes(m.status);

  await claimSeat(newSeat._id as Types.ObjectId, { membershipId: mid, studentId: m.studentId }, occupying ? "occupied" : "reserved");

  const monthlyRent = body.monthlyRent ?? m.monthlyRent;
  const history = m.seatHistory.map((h) => (typeof h === "object" && "toObject" in h ? (h as unknown as { toObject: () => object }).toObject() : h)) as MessMembershipDoc["seatHistory"];
  if (occupying && history.length) {
    const last = history[history.length - 1];
    if (!last.toDate) last.toDate = effectiveDate;
  }
  if (occupying) {
    history.push({ messId: newSeat.messId, roomId: newSeat.roomId, seatId: newSeat._id as Types.ObjectId, fromDate: effectiveDate, monthlyRent, reason: body.reason || "সিট স্থানান্তর", changedBy: actorId(req) });
  }
  let updated: MessMembershipDoc | null;
  try {
    updated = await MessMembership.findOneAndUpdate(
      { _id: mid, seatId: oldSeatId, holdsSeat: true },
      { $set: { seatId: newSeat._id, roomId: newSeat.roomId, messId: newSeat.messId, monthlyRent, seatHistory: history } },
      { new: true },
    );
  } catch (err) {
    await releaseSeat(newSeat._id as Types.ObjectId, { membershipId: mid });
    if (isDuplicateKeyError(err)) throw ApiError.conflict("নতুন সিটটি অন্য একজন সদস্যের কাছে আছে");
    throw err;
  }
  if (!updated) {
    await releaseSeat(newSeat._id as Types.ObjectId, { membershipId: mid });
    throw ApiError.conflict("সদস্যপদ ইতিমধ্যে পরিবর্তিত হয়েছে — পেজ রিফ্রেশ করে আবার চেষ্টা করুন");
  }
  await releaseSeat(oldSeatId, { membershipId: mid });
  await recordAudit({
    req,
    action: "mess.membership.transfer",
    module: "mess",
    targetCollection: "messmemberships",
    targetId: id,
    before: { messId: m.messId, roomId: m.roomId, seatId: oldSeatId, monthlyRent: m.monthlyRent },
    after: { messId: newSeat.messId, roomId: newSeat.roomId, seatId: newSeat._id, monthlyRent, effectiveDate, reason: body.reason },
  });
  return updated;
}

/** Rent/discount/deposit terms and contact details. Status and seat change only through the dedicated transitions above. */
export async function updateMembershipTerms(
  req: Request,
  id: string,
  patch: { monthlyRent?: number; discount?: number; securityDeposit?: number; setupCharge?: number; expectedLeavingDate?: string; billingStartDate?: string; emergencyContact?: { name?: string; phone?: string; relation?: string }; notes?: string; documents?: { label: string; url: string; publicId?: string }[] },
): Promise<MessMembershipDoc> {
  const m = await getMembershipOrThrow(req, id);
  if (m.status === "left" || m.status === "cancelled") throw ApiError.badRequest("সমাপ্ত সদস্যপদ পরিবর্তন করা যাবে না");
  if (patch.discount !== undefined && patch.discount !== m.discount) await assertDiscountAllowed(req, patch.discount);
  if (patch.setupCharge !== undefined && m.setupChargeBilled && patch.setupCharge !== m.setupCharge) {
    throw ApiError.badRequest("সেটআপ চার্জ ইতিমধ্যে বিলে যুক্ত হয়েছে — বিল সংশোধন করুন");
  }
  const before = m.toObject();
  for (const key of ["monthlyRent", "discount", "securityDeposit", "setupCharge", "expectedLeavingDate", "billingStartDate", "emergencyContact", "notes", "documents"] as const) {
    if (patch[key] !== undefined) (m as unknown as Record<string, unknown>)[key] = patch[key];
  }
  await m.save();
  await recomputeLedger(m._id as Types.ObjectId);
  await recordAudit({ req, action: "mess.membership.update", module: "mess", targetCollection: "messmemberships", targetId: id, before, after: m.toObject() });
  return m;
}

// -------------------- Reads --------------------

async function resolveStudentFilter(req: Request): Promise<Types.ObjectId[] | undefined> {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const courseId = typeof req.query.courseId === "string" && Types.ObjectId.isValid(req.query.courseId) ? new Types.ObjectId(req.query.courseId) : undefined;
  const batchId = typeof req.query.batchId === "string" && Types.ObjectId.isValid(req.query.batchId) ? new Types.ObjectId(req.query.batchId) : undefined;
  if (!search && !courseId && !batchId) return undefined;
  const { buildSearchFilterWithGuardian } = await import("../../students/student.service");
  const filter: Record<string, unknown> = {};
  if (courseId) filter.courseId = courseId;
  if (batchId) filter.currentBatchId = batchId;
  if (search) Object.assign(filter, await buildSearchFilterWithGuardian(search));
  return (await Student.find(filter).limit(2000).distinct("_id")) as Types.ObjectId[];
}

export { resolveStudentFilter };

export async function listMemberships(req: Request) {
  const { page, limit, skip } = parsePagination(req);
  const filter: Record<string, unknown> = {};
  const scope = await messScopeFilter(req, req.query.messId);
  if (scope) filter.messId = scope;
  if (typeof req.query.roomId === "string" && req.query.roomId) filter.roomId = toObjectId(req.query.roomId, "roomId");
  if (typeof req.query.status === "string" && req.query.status) {
    const statuses = req.query.status.split(",").filter(Boolean);
    filter.status = statuses.length === 1 ? statuses[0] : { $in: statuses };
  }
  if (req.query.hasDue === "true") filter["balance.due"] = { $gt: 0 };
  const studentIds = await resolveStudentFilter(req);
  if (studentIds) filter.studentId = { $in: studentIds };
  if (typeof req.query.studentId === "string" && Types.ObjectId.isValid(req.query.studentId)) filter.studentId = new Types.ObjectId(req.query.studentId);

  const [items, total] = await Promise.all([
    MessMembership.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-statusHistory -documents")
      .populate({ path: "studentId", select: STUDENT_FIELDS, populate: { path: "currentBatchId", select: "name" } })
      .populate("messId", "name code")
      .populate("roomId", "name floor")
      .populate("seatId", "seatNumber seatType")
      .lean(),
    MessMembership.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

export async function getMembershipProfile(req: Request, id: string) {
  const m = await getMembershipOrThrow(req, id);
  const [membership, bills, payments, depositTx, settlements, history] = await Promise.all([
    MessMembership.findById(m._id)
      .populate({ path: "studentId", select: STUDENT_FIELDS, populate: { path: "currentBatchId", select: "name" } })
      .populate("messId", "name code address contactNumber")
      .populate("roomId", "name floor roomType")
      .populate("seatId", "seatNumber seatType monthlyRent status")
      .populate("seatHistory.seatId", "seatNumber")
      .populate("seatHistory.roomId", "name")
      .populate("seatHistory.messId", "name")
      .lean(),
    MessBill.find({ membershipId: m._id }).sort({ period: -1, createdAt: -1 }).limit(36).lean(),
    MessPayment.find({ membershipId: m._id }).sort({ date: -1, createdAt: -1 }).limit(100).lean(),
    MessDepositTransaction.find({ membershipId: m._id }).sort({ createdAt: -1 }).limit(100).lean(),
    MessSettlement.find({ membershipId: m._id }).sort({ createdAt: -1 }).lean(),
    MessMembership.find({ studentId: m.studentId, _id: { $ne: m._id } })
      .select("membershipNo status joiningDate leftDate messId seatId roomId")
      .populate("messId", "name")
      .populate("roomId", "name")
      .populate("seatId", "seatNumber")
      .sort({ createdAt: -1 })
      .lean(),
  ]);
  const { Guardian } = await import("../../guardians/guardian.model");
  const guardian = await Guardian.findOne({ studentId: m.studentId }).sort({ isPrimary: -1 }).select("name phone relation").lean();
  return { membership, guardian, bills, payments, depositTransactions: depositTx, settlements, otherMemberships: history };
}

// -------------------- Reservations --------------------

/** Lazy, idempotent expiry — run before reservation/seat reads and from the Admin "expire overdue" action, so no scheduler is required. */
export async function expireOverdueReservations(req?: Request): Promise<number> {
  const today = todayISO();
  const overdue = await MessReservation.find({ status: "active", expiryDate: { $lt: today } }).select("_id seatId reservationNo").limit(500);
  let count = 0;
  for (const r of overdue) {
    const res = await MessReservation.updateOne({ _id: r._id, status: "active" }, { $set: { status: "expired", isActive: false } });
    if (res.modifiedCount) {
      count++;
      await releaseSeat(r.seatId, { reservationId: r._id as Types.ObjectId });
    }
  }
  if (count && req) {
    await recordAudit({ req, action: "mess.reservation.expire", module: "mess", targetCollection: "messreservations", after: { expired: count, ids: overdue.map((r) => r.reservationNo) } });
  }
  return count;
}

export async function listReservations(req: Request) {
  await expireOverdueReservations();
  const { page, limit, skip } = parsePagination(req);
  const filter: Record<string, unknown> = {};
  const scope = await messScopeFilter(req, req.query.messId);
  if (scope) filter.messId = scope;
  if (typeof req.query.status === "string" && req.query.status) filter.status = req.query.status;
  const studentIds = await resolveStudentFilter(req);
  if (studentIds) filter.studentId = { $in: studentIds };
  const [items, total] = await Promise.all([
    MessReservation.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("studentId", STUDENT_FIELDS)
      .populate("messId", "name code")
      .populate("roomId", "name")
      .populate("seatId", "seatNumber monthlyRent")
      .lean(),
    MessReservation.countDocuments(filter),
  ]);
  const ids = items.map((r) => r._id);
  const paid = await MessPayment.aggregate<{ _id: Types.ObjectId; total: number }>([
    { $match: { reservationId: { $in: ids }, status: "active" } },
    { $group: { _id: "$reservationId", total: { $sum: "$amount" } } },
  ]);
  return {
    items: items.map((r) => ({ ...r, advancePaid: paid.find((p) => String(p._id) === String(r._id))?.total ?? 0 })),
    meta: buildMeta(page, limit, total),
  };
}

export async function createReservation(
  req: Request,
  input: { studentId: string; messId: string; seatId: string; reservationDate?: string; expiryDate: string; advanceAmount?: number; notes?: string },
): Promise<MessReservationDoc> {
  const messId = toObjectId(input.messId, "messId");
  await assertMessAccess(req, messId);
  await expireOverdueReservations();
  const mess = await Mess.findById(messId);
  if (!mess || mess.status !== "active") throw ApiError.badRequest("মেসটি সক্রিয় নয়");
  const student = await getStudentOrThrow(input.studentId);
  await assertNoOpenMembership(student._id as Types.ObjectId);
  const reservationDate = input.reservationDate || todayISO();
  if (input.expiryDate < reservationDate) throw ApiError.badRequest("মেয়াদ শেষের তারিখ রিজার্ভেশনের তারিখের আগে হতে পারে না");
  const seat = await loadSeatForMess(input.seatId, messId);
  const reservationId = new Types.ObjectId();
  await claimSeat(seat._id as Types.ObjectId, { reservationId, studentId: student._id as Types.ObjectId }, "reserved");
  try {
    const doc = await MessReservation.create({
      _id: reservationId,
      reservationNo: await generateSequenceCode("mess_reservation", "MRS", 5),
      studentId: student._id,
      messId,
      roomId: seat.roomId,
      seatId: seat._id,
      reservationDate,
      expiryDate: input.expiryDate,
      advanceAmount: input.advanceAmount ?? 0,
      status: "active",
      isActive: true,
      notes: input.notes,
      createdBy: actorId(req),
    });
    await recordAudit({ req, action: "mess.reservation.create", module: "mess", targetCollection: "messreservations", targetId: String(doc._id), after: doc.toObject() });
    return doc;
  } catch (err) {
    await releaseSeat(seat._id as Types.ObjectId, { reservationId });
    if (isDuplicateKeyError(err)) throw ApiError.conflict("এই শিক্ষার্থীর একটি সক্রিয় রিজার্ভেশন আগেই আছে");
    throw err;
  }
}

export async function cancelReservation(req: Request, id: string, reason: string): Promise<MessReservationDoc> {
  const r = await MessReservation.findById(id);
  if (!r) throw ApiError.notFound("Reservation not found");
  await assertMessAccess(req, r.messId);
  const updated = await MessReservation.findOneAndUpdate(
    { _id: r._id, status: "active" },
    { $set: { status: "cancelled", isActive: false, cancelReason: reason } },
    { new: true },
  );
  if (!updated) throw ApiError.badRequest("রিজার্ভেশনটি সক্রিয় নেই");
  await releaseSeat(r.seatId, { reservationId: r._id as Types.ObjectId });
  await recordAudit({ req, action: "mess.reservation.cancel", module: "mess", targetCollection: "messreservations", targetId: id, before: { status: r.status }, after: { status: "cancelled", reason } });
  return updated;
}

export async function getReservationOrThrow(req: Request, id: string): Promise<MessReservationDoc> {
  const r = await MessReservation.findById(toObjectId(id, "reservationId"));
  if (!r) throw ApiError.notFound("Reservation not found");
  await assertMessAccess(req, r.messId);
  return r;
}
