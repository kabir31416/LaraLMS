import { Request } from "express";
import { Types } from "mongoose";
import { ApiError } from "../../../common/utils/ApiError";
import { recordAudit } from "../../../audit/auditLog.service";
import { buildMeta, parsePagination } from "../../../common/utils/pagination";
import { generateSequenceCode } from "../../../common/utils/idGenerators";
import { Staff } from "../../staff/staff.model";
import { Mess, MessDoc } from "../models/mess.model";
import { MessRoom, MessRoomDoc } from "../models/messRoom.model";
import { MessSeat, MessSeatDoc } from "../models/messSeat.model";
import { MessMembership } from "../models/messMembership.model";
import { MessReservation } from "../models/messReservation.model";
import { MessBill } from "../models/messBill.model";
import { MessPayment } from "../models/messPayment.model";
import { MessExpense } from "../models/messExpense.model";
import { MessComplaint } from "../models/messComplaint.model";
import { MessNotice } from "../models/messNotice.model";
import { accessibleMessIds, assertMessAccess, messScopeFilter } from "../mess.scope";
import { MessStaffResponsibility, SEAT_MANUAL_STATUS, SeatStatus } from "../mess.constants";
import { isDuplicateKeyError, nameKey, toObjectId } from "../mess.utils";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// -------------------- Mess --------------------

export async function listMesses(req: Request) {
  const filter: Record<string, unknown> = {};
  const scope = await messScopeFilter(req);
  if (scope) filter._id = scope;
  if (typeof req.query.status === "string" && req.query.status) filter.status = req.query.status;
  if (typeof req.query.search === "string" && req.query.search.trim()) {
    const rx = new RegExp(escapeRegex(req.query.search.trim()), "i");
    filter.$or = [{ name: rx }, { code: rx }, { address: rx }];
  }
  const messes = await Mess.find(filter).sort({ status: 1, name: 1 }).populate("staff.staffId", "name phone staffType staffId status").lean();
  if (messes.length === 0) return [];

  const ids = messes.map((m) => m._id);
  const [roomCounts, seatCounts, memberCounts] = await Promise.all([
    MessRoom.aggregate<{ _id: Types.ObjectId; count: number }>([{ $match: { messId: { $in: ids } } }, { $group: { _id: "$messId", count: { $sum: 1 } } }]),
    MessSeat.aggregate<{ _id: { messId: Types.ObjectId; status: SeatStatus }; count: number }>([
      { $match: { messId: { $in: ids } } },
      { $group: { _id: { messId: "$messId", status: "$status" }, count: { $sum: 1 } } },
    ]),
    MessMembership.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { messId: { $in: ids }, status: { $in: ["active", "on_leave", "notice_given"] } } },
      { $group: { _id: "$messId", count: { $sum: 1 } } },
    ]),
  ]);
  return messes.map((m) => {
    const seats: Record<string, number> = { available: 0, reserved: 0, occupied: 0, maintenance: 0, inactive: 0 };
    for (const row of seatCounts) if (String(row._id.messId) === String(m._id)) seats[row._id.status] = row.count;
    return {
      ...m,
      roomCount: roomCounts.find((r) => String(r._id) === String(m._id))?.count ?? 0,
      seatCounts: seats,
      totalSeats: Object.values(seats).reduce((a, b) => a + b, 0),
      activeMembers: memberCounts.find((r) => String(r._id) === String(m._id))?.count ?? 0,
    };
  });
}

export async function getMess(req: Request, id: string): Promise<MessDoc> {
  await assertMessAccess(req, id);
  const doc = await Mess.findById(id).populate("staff.staffId", "name phone staffType staffId status");
  if (!doc) throw ApiError.notFound("Mess not found");
  return doc;
}

async function getActiveMessOrThrow(messId: string | Types.ObjectId): Promise<MessDoc> {
  const mess = await Mess.findById(messId);
  if (!mess) throw ApiError.notFound("Mess not found");
  return mess;
}

type MessPatch = Partial<Omit<MessDoc, "defaultRent" | "defaultDiningCharge" | "defaultDeposit" | "billingDay" | "dueDay">> & {
  defaultRent?: number | null;
  defaultDiningCharge?: number | null;
  defaultDeposit?: number | null;
  billingDay?: number | null;
  dueDay?: number | null;
};

export async function createMess(req: Request, data: MessPatch): Promise<MessDoc> {
  const code = await generateSequenceCode("mess_code", "MESS", 3);
  const doc = await Mess.create({
    name: data.name,
    code,
    address: data.address,
    contactNumber: data.contactNumber,
    openingDate: data.openingDate,
    notes: data.notes,
    status: data.status ?? "active",
    defaultRent: data.defaultRent ?? undefined,
    defaultDiningCharge: data.defaultDiningCharge ?? undefined,
    defaultDeposit: data.defaultDeposit ?? undefined,
    billingDay: data.billingDay ?? undefined,
    dueDay: data.dueDay ?? undefined,
    staff: [],
    createdBy: req.user?.id,
  });
  await recordAudit({ req, action: "mess.create", module: "mess", targetCollection: "messes", targetId: String(doc._id), after: doc.toObject() });
  return doc;
}

export async function updateMess(req: Request, id: string, patch: MessPatch): Promise<MessDoc> {
  await assertMessAccess(req, id);
  const doc = await getActiveMessOrThrow(id);
  const before = doc.toObject();
  for (const key of ["name", "address", "contactNumber", "openingDate", "notes", "status"] as const) {
    if (patch[key] !== undefined) (doc as unknown as Record<string, unknown>)[key] = patch[key];
  }
  // Per-Mess billing defaults: a number overrides Mess Settings for this Mess, null removes the override. Future admissions/bills only.
  for (const key of ["defaultRent", "defaultDiningCharge", "defaultDeposit", "billingDay", "dueDay"] as const) {
    if (patch[key] === null) doc.set(key, undefined);
    else if (patch[key] !== undefined) doc.set(key, patch[key]);
  }
  await doc.save();
  await recordAudit({ req, action: "mess.update", module: "mess", targetCollection: "messes", targetId: id, before, after: doc.toObject() });
  return doc;
}

export async function setMessStaff(req: Request, id: string, staff: { staffId: string; responsibility: MessStaffResponsibility }[]): Promise<MessDoc> {
  const doc = await getActiveMessOrThrow(id);
  const unique = new Map<string, MessStaffResponsibility>();
  for (const s of staff) unique.set(s.staffId, s.responsibility);
  const ids = [...unique.keys()].map((sid) => toObjectId(sid, "staffId"));
  const found = await Staff.find({ _id: { $in: ids } }).select("_id status");
  if (found.length !== ids.length) throw ApiError.badRequest("One or more staff members were not found");
  const before = doc.toObject();
  const existing = new Map(doc.staff.map((s) => [String(s.staffId), s.assignedAt]));
  doc.staff = ids.map((sid) => ({
    staffId: sid,
    responsibility: unique.get(String(sid))!,
    assignedAt: existing.get(String(sid)) ?? new Date(),
  }));
  await doc.save();
  await recordAudit({ req, action: "mess.staff.update", module: "mess", targetCollection: "messes", targetId: id, before: { staff: before.staff }, after: { staff: doc.staff } });
  return doc.populate("staff.staffId", "name phone staffType staffId status");
}

/** Hard delete is only for a Mess created by mistake with nothing attached. Anything with history is deactivated instead. */
export async function deleteMess(req: Request, id: string): Promise<void> {
  const doc = await getActiveMessOrThrow(id);
  const checks = await Promise.all([
    MessRoom.exists({ messId: id }),
    MessMembership.exists({ $or: [{ messId: id }, { "seatHistory.messId": id }] }),
    MessReservation.exists({ messId: id }),
    MessBill.exists({ messId: id }),
    MessPayment.exists({ messId: id }),
    MessExpense.exists({ messId: id }),
    MessComplaint.exists({ messId: id }),
    MessNotice.exists({ messId: id }),
  ]);
  if (checks.some(Boolean)) {
    throw ApiError.conflict("এই মেসে রুম, সদস্য বা আর্থিক রেকর্ড আছে — মুছে ফেলা যাবে না। এর বদলে নিষ্ক্রিয় করুন।");
  }
  await doc.deleteOne();
  await recordAudit({ req, action: "mess.delete", module: "mess", targetCollection: "messes", targetId: id, before: doc.toObject() });
}

/** Staff picker for Mess staff assignment — minimal fields only, so assigning staff doesn't require the full Staff module permission. */
export async function staffOptions() {
  return Staff.find({ status: "সক্রিয়" }).select("name phone staffType staffId").sort({ name: 1 }).limit(500).lean();
}

// -------------------- Rooms --------------------

export async function listRooms(req: Request) {
  const filter: Record<string, unknown> = {};
  const scope = await messScopeFilter(req, req.query.messId);
  if (scope) filter.messId = scope;
  if (typeof req.query.status === "string" && req.query.status) filter.status = req.query.status;
  const rooms = await MessRoom.find(filter).sort({ messId: 1, floor: 1, nameKey: 1 }).limit(1000).lean();
  if (rooms.length === 0) return [];
  const seatCounts = await MessSeat.aggregate<{ _id: { roomId: Types.ObjectId; status: SeatStatus }; count: number }>([
    { $match: { roomId: { $in: rooms.map((r) => r._id) } } },
    { $group: { _id: { roomId: "$roomId", status: "$status" }, count: { $sum: 1 } } },
  ]);
  return rooms.map((r) => {
    const seats: Record<string, number> = { available: 0, reserved: 0, occupied: 0, maintenance: 0, inactive: 0 };
    for (const row of seatCounts) if (String(row._id.roomId) === String(r._id)) seats[row._id.status] = row.count;
    return { ...r, seatCounts: seats, seatCount: Object.values(seats).reduce((a, b) => a + b, 0) };
  });
}

async function getRoomOrThrow(req: Request, id: string): Promise<MessRoomDoc> {
  const room = await MessRoom.findById(id);
  if (!room) throw ApiError.notFound("Room not found");
  await assertMessAccess(req, room.messId);
  return room;
}

export async function createRoom(req: Request, data: Partial<MessRoomDoc> & { messId: string }): Promise<MessRoomDoc> {
  await assertMessAccess(req, data.messId);
  await getActiveMessOrThrow(data.messId);
  try {
    const room = await MessRoom.create({
      messId: data.messId,
      name: data.name,
      nameKey: nameKey(data.name ?? ""),
      floor: data.floor,
      roomType: data.roomType,
      totalSeats: data.totalSeats ?? 0,
      facilities: data.facilities ?? [],
      status: data.status ?? "active",
      notes: data.notes,
    });
    await recordAudit({ req, action: "mess.room.create", module: "mess", targetCollection: "messrooms", targetId: String(room._id), after: room.toObject() });
    return room;
  } catch (err) {
    if (isDuplicateKeyError(err)) throw ApiError.conflict(`এই মেসে "${data.name}" নামের রুম আগেই আছে`);
    throw err;
  }
}

export async function updateRoom(req: Request, id: string, patch: Partial<MessRoomDoc>): Promise<MessRoomDoc> {
  const room = await getRoomOrThrow(req, id);
  const before = room.toObject();
  if (patch.totalSeats !== undefined) {
    const seatCount = await MessSeat.countDocuments({ roomId: room._id });
    if (patch.totalSeats < seatCount) throw ApiError.badRequest(`এই রুমে ইতিমধ্যে ${seatCount}টি সিট আছে — ধারণক্ষমতা এর কম করা যাবে না`);
  }
  if (patch.status && patch.status !== "active" && room.status === "active") {
    const held = await MessSeat.exists({ roomId: room._id, status: { $in: ["reserved", "occupied"] } });
    if (held) throw ApiError.conflict("এই রুমের কোনো সিটে সদস্য/রিজার্ভেশন আছে — আগে তাদের স্থানান্তর করুন");
  }
  if (patch.name !== undefined) {
    room.name = patch.name;
    room.nameKey = nameKey(patch.name);
  }
  for (const key of ["floor", "roomType", "totalSeats", "facilities", "status", "notes"] as const) {
    if (patch[key] !== undefined) (room as unknown as Record<string, unknown>)[key] = patch[key];
  }
  try {
    await room.save();
  } catch (err) {
    if (isDuplicateKeyError(err)) throw ApiError.conflict(`এই মেসে "${patch.name}" নামের রুম আগেই আছে`);
    throw err;
  }
  await recordAudit({ req, action: "mess.room.update", module: "mess", targetCollection: "messrooms", targetId: id, before, after: room.toObject() });
  return room;
}

export async function deleteRoom(req: Request, id: string): Promise<void> {
  const room = await getRoomOrThrow(req, id);
  const [hasSeats, hasHistory] = await Promise.all([
    MessSeat.exists({ roomId: room._id }),
    MessMembership.exists({ $or: [{ roomId: room._id }, { "seatHistory.roomId": room._id }] }),
  ]);
  if (hasSeats || hasHistory) throw ApiError.conflict("এই রুমে সিট বা সদস্যপদের ইতিহাস আছে — মুছে ফেলা যাবে না। এর বদলে নিষ্ক্রিয় করুন।");
  await room.deleteOne();
  await recordAudit({ req, action: "mess.room.delete", module: "mess", targetCollection: "messrooms", targetId: id, before: room.toObject() });
}

// -------------------- Seats --------------------

export async function listSeats(req: Request) {
  const { page, limit, skip } = parsePagination(req);
  const filter: Record<string, unknown> = {};
  const scope = await messScopeFilter(req, req.query.messId);
  if (scope) filter.messId = scope;
  if (typeof req.query.roomId === "string" && req.query.roomId) filter.roomId = toObjectId(req.query.roomId, "roomId");
  if (typeof req.query.status === "string" && req.query.status) filter.status = req.query.status;
  if (typeof req.query.seatType === "string" && req.query.seatType) filter.seatType = req.query.seatType;
  if (typeof req.query.search === "string" && req.query.search.trim()) {
    filter.seatNumber = new RegExp(escapeRegex(req.query.search.trim()), "i");
  }
  if (req.query.availableOnly === "true") {
    filter.status = "available";
    // Seats inside a room that's under maintenance/inactive are never offered.
    const activeRooms = await MessRoom.find({ ...(scope ? { messId: scope } : {}), status: "active" }).distinct("_id");
    filter.roomId = filter.roomId ? filter.roomId : { $in: activeRooms };
    if (filter.roomId instanceof Types.ObjectId && !activeRooms.some((r) => String(r) === String(filter.roomId))) {
      return { items: [], meta: buildMeta(page, limit, 0) };
    }
  }
  const [items, total] = await Promise.all([
    MessSeat.find(filter)
      .sort({ messId: 1, roomId: 1, seatNumberKey: 1 })
      .skip(skip)
      .limit(limit)
      .populate("roomId", "name floor roomType status")
      .populate("messId", "name code status")
      .populate("currentStudentId", "name registrationId currentRollNumber phone")
      .lean(),
    MessSeat.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

async function getSeatOrThrow(req: Request, id: string): Promise<MessSeatDoc> {
  const seat = await MessSeat.findById(id);
  if (!seat) throw ApiError.notFound("Seat not found");
  await assertMessAccess(req, seat.messId);
  return seat;
}

export async function createSeats(
  req: Request,
  data: { roomId: string; seatNumber?: string; count?: number; prefix?: string; startNumber?: number; seatType?: string; monthlyRent: number; availableFrom?: string; notes?: string },
): Promise<MessSeatDoc[]> {
  const room = await getRoomOrThrow(req, data.roomId);
  const numbers: string[] = data.seatNumber
    ? [data.seatNumber.trim()]
    : Array.from({ length: data.count ?? 1 }, (_, i) => `${data.prefix ?? ""}${(data.startNumber ?? 1) + i}`);
  if (numbers.length === 0) throw ApiError.badRequest("No seats to create");
  const existingCount = await MessSeat.countDocuments({ roomId: room._id });
  if (existingCount + numbers.length > room.totalSeats) {
    throw ApiError.badRequest(`রুমের ধারণক্ষমতা ${room.totalSeats}টি সিট — এখন আছে ${existingCount}টি। আগে রুমের মোট সিট সংখ্যা বাড়ান।`);
  }
  const keys = numbers.map(nameKey);
  if (new Set(keys).size !== keys.length) throw ApiError.badRequest("Duplicate seat numbers in request");
  const clash = await MessSeat.find({ roomId: room._id, seatNumberKey: { $in: keys } }).select("seatNumber");
  if (clash.length) throw ApiError.conflict(`এই রুমে সিট নম্বর আগেই আছে: ${clash.map((c) => c.seatNumber).join(", ")}`);
  try {
    const seats = await MessSeat.insertMany(
      numbers.map((n) => ({
        messId: room.messId,
        roomId: room._id,
        seatNumber: n,
        seatNumberKey: nameKey(n),
        seatType: data.seatType,
        monthlyRent: data.monthlyRent,
        availableFrom: data.availableFrom,
        notes: data.notes,
        status: "available",
      })),
      { ordered: true },
    );
    await recordAudit({
      req,
      action: "mess.seat.create",
      module: "mess",
      targetCollection: "messseats",
      targetId: String(room._id),
      after: { roomId: room._id, seats: seats.map((s) => ({ id: s._id, seatNumber: s.seatNumber, monthlyRent: s.monthlyRent })) },
    });
    return seats as unknown as MessSeatDoc[];
  } catch (err) {
    if (isDuplicateKeyError(err)) throw ApiError.conflict("এই রুমে একই সিট নম্বর আগেই আছে");
    throw err;
  }
}

export async function updateSeat(
  req: Request,
  id: string,
  patch: { seatNumber?: string; seatType?: string; monthlyRent?: number; availableFrom?: string; notes?: string; status?: (typeof SEAT_MANUAL_STATUS)[number] },
): Promise<MessSeatDoc> {
  const seat = await getSeatOrThrow(req, id);
  const before = seat.toObject();
  if (patch.status && patch.status !== seat.status) {
    // Manual status changes are only allowed on a seat nobody holds — the
    // conditional update makes this safe against a concurrent assignment.
    const updated = await MessSeat.findOneAndUpdate(
      { _id: seat._id, status: { $in: SEAT_MANUAL_STATUS }, currentMembershipId: { $exists: false }, currentReservationId: { $exists: false } },
      { $set: { status: patch.status } },
      { new: true },
    );
    if (!updated) throw ApiError.conflict("সিটটি একজন সদস্য/রিজার্ভেশনের কাছে আছে — স্ট্যাটাস হাতে পরিবর্তন করা যাবে না");
    seat.status = updated.status;
  }
  if (patch.seatNumber !== undefined) {
    seat.seatNumber = patch.seatNumber.trim();
    seat.seatNumberKey = nameKey(patch.seatNumber);
  }
  for (const key of ["seatType", "monthlyRent", "availableFrom", "notes"] as const) {
    if (patch[key] !== undefined) (seat as unknown as Record<string, unknown>)[key] = patch[key];
  }
  try {
    await seat.save();
  } catch (err) {
    if (isDuplicateKeyError(err)) throw ApiError.conflict("এই রুমে একই সিট নম্বর আগেই আছে");
    throw err;
  }
  await recordAudit({ req, action: "mess.seat.update", module: "mess", targetCollection: "messseats", targetId: id, before, after: seat.toObject() });
  return seat;
}

export async function deleteSeat(req: Request, id: string): Promise<void> {
  const seat = await getSeatOrThrow(req, id);
  const [membership, reservation] = await Promise.all([
    MessMembership.exists({ $or: [{ seatId: seat._id }, { "seatHistory.seatId": seat._id }] }),
    MessReservation.exists({ seatId: seat._id }),
  ]);
  if (membership || reservation || seat.currentMembershipId || seat.currentReservationId) {
    throw ApiError.conflict("এই সিটের সদস্যপদ/রিজার্ভেশনের ইতিহাস আছে — মুছে ফেলা যাবে না। এর বদলে নিষ্ক্রিয় করুন।");
  }
  await seat.deleteOne();
  await recordAudit({ req, action: "mess.seat.delete", module: "mess", targetCollection: "messseats", targetId: id, before: seat.toObject() });
}

/** Every member who ever sat in this seat, newest first. */
export async function seatHistory(req: Request, id: string) {
  const seat = await getSeatOrThrow(req, id);
  const memberships = await MessMembership.find({ "seatHistory.seatId": seat._id })
    .populate("studentId", "name registrationId currentRollNumber phone")
    .select("membershipNo studentId status seatHistory")
    .lean();
  const rows = memberships.flatMap((m) =>
    m.seatHistory
      .filter((h) => String(h.seatId) === String(seat._id))
      .map((h) => ({ membershipId: m._id, membershipNo: m.membershipNo, student: m.studentId, status: m.status, fromDate: h.fromDate, toDate: h.toDate, monthlyRent: h.monthlyRent, reason: h.reason })),
  );
  const reservations = await MessReservation.find({ seatId: seat._id })
    .populate("studentId", "name registrationId")
    .select("reservationNo studentId reservationDate expiryDate status")
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  rows.sort((a, b) => b.fromDate.localeCompare(a.fromDate));
  return { seat, history: rows, reservations };
}

// -------------------- Atomic seat hold transitions --------------------

/**
 * Hands a seat to a membership/reservation in ONE conditional update — the
 * filter only matches while the seat is still free (or still held by the
 * same reservation being converted), so of two concurrent requests for the
 * same seat exactly one succeeds and the other gets a clean 409.
 */
export async function claimSeat(
  seatId: Types.ObjectId,
  holder: { membershipId?: Types.ObjectId; reservationId?: Types.ObjectId; studentId: Types.ObjectId },
  newStatus: "reserved" | "occupied",
  opts: { fromReservationId?: Types.ObjectId; fromMembershipId?: Types.ObjectId } = {},
): Promise<MessSeatDoc> {
  const filter: Record<string, unknown> = { _id: seatId };
  if (opts.fromReservationId) {
    filter.currentReservationId = opts.fromReservationId;
  } else if (opts.fromMembershipId) {
    filter.currentMembershipId = opts.fromMembershipId;
  } else {
    filter.status = "available";
    filter.currentMembershipId = { $exists: false };
    filter.currentReservationId = { $exists: false };
  }
  const set: Record<string, unknown> = { status: newStatus, currentStudentId: holder.studentId };
  const unset: Record<string, ""> = {};
  if (holder.membershipId) set.currentMembershipId = holder.membershipId;
  else unset.currentMembershipId = "";
  if (holder.reservationId) set.currentReservationId = holder.reservationId;
  else unset.currentReservationId = "";
  const seat = await MessSeat.findOneAndUpdate(filter, { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) }, { new: true });
  if (!seat) throw ApiError.conflict("সিটটি এখন খালি নেই — অন্য কেউ এটি নিয়েছেন বা এটি রক্ষণাবেক্ষণে আছে");
  // A seat inside an inactive/maintenance room or Mess must never be handed out.
  if (!opts.fromReservationId && !opts.fromMembershipId) {
    const [room, mess] = await Promise.all([MessRoom.findById(seat.roomId).select("status"), Mess.findById(seat.messId).select("status")]);
    if (room?.status !== "active" || mess?.status !== "active") {
      await releaseSeat(seatId, holder);
      throw ApiError.conflict("এই রুম/মেস এখন সক্রিয় নয় — সিট বরাদ্দ দেওয়া যাবে না");
    }
  }
  return seat;
}

/** Frees a seat — only if it's still held by the given holder, so a stale call can never evict somebody else. */
export async function releaseSeat(seatId: Types.ObjectId, holder: { membershipId?: Types.ObjectId; reservationId?: Types.ObjectId }): Promise<void> {
  const filter: Record<string, unknown> = { _id: seatId };
  if (holder.membershipId) filter.currentMembershipId = holder.membershipId;
  else if (holder.reservationId) filter.currentReservationId = holder.reservationId;
  else return;
  await MessSeat.updateOne(filter, {
    $set: { status: "available" },
    $unset: { currentMembershipId: "", currentReservationId: "", currentStudentId: "" },
  });
}

export async function getSeatForAssignment(req: Request, seatId: string): Promise<MessSeatDoc> {
  return getSeatOrThrow(req, seatId);
}

export { accessibleMessIds };
