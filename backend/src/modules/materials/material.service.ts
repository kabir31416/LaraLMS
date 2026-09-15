import { Request } from "express";
import { PipelineStage, Types } from "mongoose";
import { Material, MaterialDoc } from "./material.model";
import { StockMovement, StockMovementDoc, STOCK_MOVEMENT_TYPES } from "./stockMovement.model";
import { MaterialDistribution, MaterialDistributionDoc, MaterialDistributionItem } from "./materialDistribution.model";
import { Student } from "../students/student.model";
import { Batch } from "../batches/batch.model";
import { Course } from "../courses/course.model";
import { Subject } from "../subjects/subject.model";
import { Staff } from "../staff/staff.model";
import * as materialTypeService from "../materialTypes/materialType.service";
import * as settingsService from "../settings/settings.service";
import * as paymentService from "../payments/payment.service";
import { PERMISSIONS } from "../rbac/permissions";
import { ApiError } from "../../common/utils/ApiError";
import { recordAudit } from "../../audit/auditLog.service";
import { buildMeta, buildSearchFilter, parsePagination } from "../../common/utils/pagination";

// -------------------- helpers --------------------

async function getDocOrThrow(id: string): Promise<MaterialDoc> {
  const doc = await Material.findById(id);
  if (!doc) throw ApiError.notFound("Material not found");
  return doc;
}

function isDuplicateKeyError(err: unknown): boolean {
  return !!err && typeof err === "object" && (err as { code?: number }).code === 11000;
}

/**
 * The single choke point every stock-changing operation must go through
 * (§3 "never silently overwrite stock") — mutates Material.currentStock and
 * writes the matching StockMovement in the same call, so the two can never
 * drift apart.
 */
async function applyStockMovement(
  material: MaterialDoc,
  movementType: (typeof STOCK_MOVEMENT_TYPES)[number],
  delta: number,
  req: Request,
  opts: { referenceId?: Types.ObjectId; reason?: string } = {},
): Promise<StockMovementDoc> {
  const previousStock = material.currentStock;
  const newStock = previousStock + delta;
  if (newStock < 0) {
    throw ApiError.badRequest(`"${material.name}" এর স্টক ঋণাত্মক হতে পারে না (বর্তমান: ${previousStock}, পরিবর্তন: ${delta})`);
  }
  material.currentStock = newStock;
  await material.save();
  return StockMovement.create({
    materialId: material._id,
    materialName: material.name,
    movementType,
    quantity: delta,
    previousStock,
    newStock,
    referenceId: opts.referenceId,
    reason: opts.reason,
    createdBy: req.user!.id,
  });
}

async function resolveActorName(req: Request): Promise<string> {
  if (req.user!.staffId) {
    const staff = await Staff.findById(req.user!.staffId).select("name");
    if (staff) return staff.name;
  }
  return req.user!.role || "Admin";
}

// -------------------- Material Master (§1) --------------------

export async function list(req: Request) {
  const { page, limit, skip, sort } = parsePagination(req, { createdAt: -1 });
  const filter: Record<string, unknown> = { ...buildSearchFilter(req.query.search, ["name", "materialType"]) };
  if (req.query.materialType) filter.materialType = req.query.materialType;
  if (req.query.courseId) filter.courseId = req.query.courseId;
  if (req.query.subjectId) filter.subjectId = req.query.subjectId;
  if (req.query.isPaid) filter.isPaid = req.query.isPaid === "true";
  if (req.query.status) filter.status = req.query.status;
  if (req.query.stockStatus === "out") filter.currentStock = 0;
  else if (req.query.stockStatus === "low") filter.$expr = { $and: [{ $gt: ["$currentStock", 0] }, { $lte: ["$currentStock", "$minimumStock"] }] };

  const [items, total] = await Promise.all([
    Material.find(filter).sort(sort).skip(skip).limit(limit),
    Material.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

export async function getById(id: string): Promise<MaterialDoc> {
  return getDocOrThrow(id);
}

interface MaterialInput {
  name: string;
  materialType: string;
  courseId: string;
  subjectId?: string;
  isPaid: boolean;
  price: number;
  openingStock: number;
  minimumStock: number;
  status?: string;
  description?: string;
}

export async function create(req: Request, data: MaterialInput): Promise<MaterialDoc> {
  await materialTypeService.assertActiveType(data.materialType);
  if (!(await Course.exists({ _id: data.courseId }))) throw ApiError.badRequest("Invalid course");
  if (data.subjectId && !(await Subject.exists({ _id: data.subjectId }))) throw ApiError.badRequest("Invalid subject");

  const price = data.isPaid ? data.price : 0;
  if (data.isPaid && price <= 0) throw ApiError.badRequest("পেইড ম্যাটেরিয়ালের জন্য মূল্য অবশ্যই শূন্যের বেশি হতে হবে");

  let doc: MaterialDoc;
  try {
    doc = await Material.create({
      ...data,
      price,
      currentStock: data.openingStock,
      createdBy: req.user!.id,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) throw ApiError.conflict("এই কোর্সে এই নামে একটি ম্যাটেরিয়াল ইতিমধ্যে আছে");
    throw err;
  }

  if (data.openingStock > 0) {
    await StockMovement.create({
      materialId: doc._id,
      materialName: doc.name,
      movementType: "IN",
      quantity: data.openingStock,
      previousStock: 0,
      newStock: data.openingStock,
      reason: "প্রারম্ভিক স্টক",
      createdBy: req.user!.id,
    });
  }

  await recordAudit({ req, action: "material.create", module: "materials", targetCollection: "materials", targetId: String(doc._id), after: doc.toObject() });
  return doc;
}

export async function update(req: Request, id: string, patch: Partial<MaterialInput>): Promise<MaterialDoc> {
  const doc = await getDocOrThrow(id);
  const before = doc.toObject();

  if (patch.materialType) await materialTypeService.assertActiveType(patch.materialType);
  if (patch.courseId && !(await Course.exists({ _id: patch.courseId }))) throw ApiError.badRequest("Invalid course");
  if (patch.subjectId && !(await Subject.exists({ _id: patch.subjectId }))) throw ApiError.badRequest("Invalid subject");

  // Opening stock and status are never editable through the general update —
  // opening stock is a one-time historical fact (use Add Stock instead), and
  // status changes go through the dedicated deactivate/reactivate endpoint.
  const { openingStock: _ignored, status: _ignoredStatus, ...rest } = patch;
  Object.assign(doc, rest);
  if (!doc.isPaid) doc.price = 0;
  else if (doc.price <= 0) throw ApiError.badRequest("পেইড ম্যাটেরিয়ালের জন্য মূল্য অবশ্যই শূন্যের বেশি হতে হবে");
  doc.updatedBy = req.user!.id as unknown as Types.ObjectId;

  try {
    await doc.save();
  } catch (err) {
    if (isDuplicateKeyError(err)) throw ApiError.conflict("এই কোর্সে এই নামে একটি ম্যাটেরিয়াল ইতিমধ্যে আছে");
    throw err;
  }

  await recordAudit({ req, action: "material.update", module: "materials", targetCollection: "materials", targetId: id, before, after: doc.toObject() });
  return doc;
}

/** Never a hard delete (§2/§19) — a Material with distribution history must stay visible for reporting; only its visibility to new distributions changes. */
export async function setStatus(req: Request, id: string, status: string): Promise<MaterialDoc> {
  const doc = await getDocOrThrow(id);
  const before = doc.toObject();
  doc.status = status as MaterialDoc["status"];
  doc.updatedBy = req.user!.id as unknown as Types.ObjectId;
  await doc.save();
  await recordAudit({ req, action: "material.set-status", module: "materials", targetCollection: "materials", targetId: id, before, after: doc.toObject() });
  return doc;
}

// -------------------- Stock Management (§3, §13) --------------------

export async function addStock(req: Request, id: string, quantity: number, reason?: string): Promise<MaterialDoc> {
  const doc = await getDocOrThrow(id);
  await applyStockMovement(doc, "IN", quantity, req, { reason: reason || "নতুন স্টক যোগ" });
  await recordAudit({ req, action: "material.stock-add", module: "materials", targetCollection: "materials", targetId: id, after: { quantity, currentStock: doc.currentStock } });
  return doc;
}

export async function adjustStock(req: Request, id: string, quantity: number, reason: string, note?: string): Promise<MaterialDoc> {
  const doc = await getDocOrThrow(id);
  await applyStockMovement(doc, "ADJUSTMENT", quantity, req, { reason: note ? `${reason} — ${note}` : reason });
  await recordAudit({ req, action: "material.stock-adjust", module: "materials", targetCollection: "materials", targetId: id, after: { quantity, reason, currentStock: doc.currentStock } });
  return doc;
}

export async function listMovements(req: Request, materialId: string) {
  const { page, limit, skip } = parsePagination(req, { createdAt: -1 });
  const filter = { materialId };
  const [items, total] = await Promise.all([
    StockMovement.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    StockMovement.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

// -------------------- Student Distribution (§4, §8, §9, §14) --------------------

export interface DuplicateWarning {
  materialId: string;
  materialName: string;
  previousDistributions: { date: string; quantity: number }[];
}

/** §8 — a pure read-only preview the frontend calls right after picking a student + materials, before the admin confirms. Never blocks anything itself. */
export async function checkDuplicate(studentId: string, materialIds: string[]): Promise<DuplicateWarning[]> {
  const existing = await MaterialDistribution.find({
    studentId,
    status: "ACTIVE",
    "items.materialId": { $in: materialIds.map((id) => new Types.ObjectId(id)) },
  })
    .select("items distributionDate")
    .sort({ createdAt: -1 });

  const byMaterial = new Map<string, DuplicateWarning>();
  for (const dist of existing) {
    for (const item of dist.items) {
      const key = String(item.materialId);
      if (!materialIds.includes(key)) continue;
      if (!byMaterial.has(key)) byMaterial.set(key, { materialId: key, materialName: item.materialName, previousDistributions: [] });
      byMaterial.get(key)!.previousDistributions.push({ date: dist.distributionDate, quantity: item.quantity });
    }
  }
  return Array.from(byMaterial.values());
}

export interface DistributionInput {
  studentId: string;
  items: { materialId: string; quantity: number }[];
  distributionDate?: string;
  note?: string;
  collectPayment?: { method: string };
}

/**
 * §4/§5/§9 — validates every line item up front (stock sufficiency, active
 * status) before writing anything, then creates the distribution record,
 * decrements stock with one StockMovement per item, and — for a paid
 * total — collects payment through the existing Payment Transaction system
 * (§6), never a second finance module. Mongo transactions aren't available
 * in this deployment (no replica set — same constraint documented in
 * enrollment.service.ts), so consistency here comes from validating
 * everything first and only then applying writes sequentially, matching
 * this codebase's existing convention for multi-document operations.
 */
export async function createDistribution(req: Request, data: DistributionInput): Promise<MaterialDistributionDoc> {
  const student = await Student.findById(data.studentId);
  if (!student) throw ApiError.notFound("Student not found");

  const seen = new Set<string>();
  const materials = new Map<string, MaterialDoc>();
  for (const item of data.items) {
    if (seen.has(item.materialId)) throw ApiError.badRequest("একই ম্যাটেরিয়াল একাধিক লাইনে দেওয়া যাবে না — একটি লাইনেই পরিমাণ বাড়ান");
    seen.add(item.materialId);

    const material = await Material.findById(item.materialId);
    if (!material) throw ApiError.notFound("Material not found");
    if (material.status !== "সক্রিয়") throw ApiError.badRequest(`"${material.name}" নিষ্ক্রিয় — বিতরণ করা যাবে না`);
    if (material.currentStock === 0) throw ApiError.badRequest(`"${material.name}" স্টকে নেই`);
    if (item.quantity > material.currentStock) {
      throw ApiError.badRequest(`"${material.name}" এর জন্য পর্যাপ্ত স্টক নেই — উপলব্ধ: ${material.currentStock}, অনুরোধ: ${item.quantity}`);
    }
    materials.set(item.materialId, material);
  }

  // Server-enforced duplicate rule (§8) — "block" refuses outright no matter
  // what the client sends; "warn"/"allow" never block here, since the
  // warning itself is the separate checkDuplicate() preview the frontend
  // calls before this, matching "smart but never automatically blocking."
  const materialSettings = await settingsService.getMaterialSettings();
  if (materialSettings.duplicateDistributionRule === "block") {
    const dup = await MaterialDistribution.exists({
      studentId: data.studentId,
      status: "ACTIVE",
      "items.materialId": { $in: data.items.map((i) => new Types.ObjectId(i.materialId)) },
    });
    if (dup) throw ApiError.conflict("এই শিক্ষার্থীকে এই ম্যাটেরিয়াল আগে দেওয়া হয়েছে — সেটিংসে ডুপ্লিকেট বিতরণ নীতি 'Block' করা আছে");
  }

  const items: MaterialDistributionItem[] = data.items.map((i) => {
    const m = materials.get(i.materialId)!;
    const unitPrice = m.isPaid ? m.price : 0;
    return {
      materialId: m._id as Types.ObjectId,
      materialName: m.name,
      materialType: m.materialType,
      isPaid: m.isPaid,
      unitPrice,
      quantity: i.quantity,
      lineTotal: unitPrice * i.quantity,
    };
  });
  const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPaidAmount = items.reduce((sum, i) => sum + i.lineTotal, 0);

  const batch = student.currentBatchId ? await Batch.findById(student.currentBatchId).select("name") : null;
  const course = student.courseId ? await Course.findById(student.courseId).select("name") : null;
  const distributedByName = await resolveActorName(req);

  const distribution = await MaterialDistribution.create({
    studentId: student._id,
    registrationId: student.registrationId,
    studentRoll: student.currentRollNumber,
    studentName: student.name,
    phone: student.phone,
    batchId: student.currentBatchId,
    batchName: batch?.name,
    courseId: student.courseId,
    courseName: course?.name,
    items,
    totalQuantity,
    totalPaidAmount,
    distributionDate: data.distributionDate || new Date().toISOString().slice(0, 10),
    status: "ACTIVE",
    note: data.note,
    createdBy: req.user!.id,
    distributedByName,
  });

  for (const item of items) {
    const material = materials.get(String(item.materialId))!;
    await applyStockMovement(material, "DISTRIBUTION", -item.quantity, req, {
      referenceId: distribution._id as Types.ObjectId,
      reason: `বিতরণ: ${student.name}`,
    });
  }

  if (totalPaidAmount > 0 && data.collectPayment) {
    const materialNames = items.filter((i) => i.isPaid).map((i) => i.materialName).join(", ");
    const payment = await paymentService.create(req, {
      studentId: String(student._id),
      date: distribution.distributionDate,
      amount: totalPaidAmount,
      discount: 0,
      fine: 0,
      method: data.collectPayment.method,
      feeType: "ম্যাটেরিয়াল",
      note: `ম্যাটেরিয়াল বিতরণ: ${materialNames}`,
      source: "material",
    });
    distribution.paymentId = payment._id as Types.ObjectId;
    await distribution.save();
  }

  await recordAudit({ req, action: "material.distribute", module: "materials", targetCollection: "materialdistributions", targetId: String(distribution._id), after: distribution.toObject() });
  return distribution;
}

export async function listDistributions(req: Request) {
  const { page, limit, skip, sort } = parsePagination(req, { createdAt: -1 });
  const filter: Record<string, unknown> = { ...buildSearchFilter(req.query.search, ["studentName", "studentRoll", "registrationId", "phone"]) };
  if (req.query.studentId) filter.studentId = req.query.studentId;
  if (req.query.batchId) filter.batchId = req.query.batchId;
  if (req.query.courseId) filter.courseId = req.query.courseId;
  if (req.query.materialId) filter["items.materialId"] = req.query.materialId;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.dateFrom || req.query.dateTo) {
    filter.distributionDate = {
      ...(req.query.dateFrom ? { $gte: req.query.dateFrom } : {}),
      ...(req.query.dateTo ? { $lte: req.query.dateTo } : {}),
    };
  }
  const [items, total] = await Promise.all([
    MaterialDistribution.find(filter).sort(sort).skip(skip).limit(limit),
    MaterialDistribution.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

export async function getDistributionById(id: string): Promise<MaterialDistributionDoc> {
  const doc = await MaterialDistribution.findById(id);
  if (!doc) throw ApiError.notFound("Distribution not found");
  return doc;
}

/** §14 — never deletes; restores stock, flips status, and keeps the row (and everything it ever contained) visible forever. Does not touch/refund a linked Payment — a payment is an immutable financial event (payment.service.ts), so a refund is its own separate correction entered in Fee Management, never an automatic side effect here. */
export async function reverseDistribution(req: Request, id: string, reason: string): Promise<MaterialDistributionDoc> {
  const distribution = await MaterialDistribution.findById(id);
  if (!distribution) throw ApiError.notFound("Distribution not found");
  if (distribution.status !== "ACTIVE") throw ApiError.conflict("এই বিতরণ ইতিমধ্যে বাতিল করা হয়েছে");

  for (const item of distribution.items) {
    const material = await Material.findById(item.materialId);
    if (!material) continue; // defensive — Material is never hard-deleted, but guards against pre-existing data issues
    await applyStockMovement(material, "REVERSAL", item.quantity, req, {
      referenceId: distribution._id as Types.ObjectId,
      reason: `বিতরণ বাতিল: ${reason}`,
    });
  }

  distribution.status = "REVERSED";
  distribution.reversedBy = req.user!.id as unknown as Types.ObjectId;
  distribution.reversedAt = new Date();
  distribution.reversalReason = reason;
  await distribution.save();

  await recordAudit({ req, action: "material.distribution-reverse", module: "materials", targetCollection: "materialdistributions", targetId: id, after: { status: "REVERSED", reason } });
  return distribution;
}

// -------------------- Student Material History (§7) --------------------

function resolveSelfScope(req: Request, studentId: string): void {
  const perms = req.user!.permissions;
  const hasBroad = perms.includes("*") || perms.includes(PERMISSIONS.MATERIALS_DISTRIBUTION_VIEW) || perms.includes(PERMISSIONS.MATERIALS_VIEW);
  if (hasBroad) return;
  if (req.user!.studentId !== studentId) throw ApiError.forbidden("You may only view your own material history");
}

export async function getStudentHistory(req: Request, studentId: string) {
  resolveSelfScope(req, studentId);
  const distributions = await MaterialDistribution.find({ studentId }).sort({ createdAt: -1 });
  const rows = distributions.flatMap((dist) =>
    dist.items.map((item) => ({
      distributionId: String(dist._id),
      date: dist.distributionDate,
      materialName: item.materialName,
      materialType: item.materialType,
      quantity: item.quantity,
      isPaid: item.isPaid,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      distributedBy: dist.distributedByName,
      status: dist.status,
    })),
  );
  return rows;
}

// -------------------- Dashboard (§11) --------------------

export async function getDashboardStats(_req: Request) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1);

  const [totalMaterials, stockAgg, distributedToday, distributedThisMonth, lowStockCount, outOfStockCount, mostDistributed, recentDistributions] = await Promise.all([
    Material.countDocuments({ status: "সক্রিয়" }),
    Material.aggregate<{ _id: null; totalStock: number }>([{ $match: { status: "সক্রিয়" } }, { $group: { _id: null, totalStock: { $sum: "$currentStock" } } }]),
    MaterialDistribution.aggregate<{ _id: null; qty: number }>([
      { $match: { status: "ACTIVE", createdAt: { $gte: startOfToday } } },
      { $group: { _id: null, qty: { $sum: "$totalQuantity" } } },
    ]),
    MaterialDistribution.aggregate<{ _id: null; qty: number }>([
      { $match: { status: "ACTIVE", createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, qty: { $sum: "$totalQuantity" } } },
    ]),
    Material.countDocuments({ status: "সক্রিয়", $expr: { $and: [{ $gt: ["$currentStock", 0] }, { $lte: ["$currentStock", "$minimumStock"] }] } }),
    Material.countDocuments({ status: "সক্রিয়", currentStock: 0 }),
    MaterialDistribution.aggregate<{ _id: string; materialName: string; totalQuantity: number }>([
      { $match: { status: "ACTIVE" } },
      { $unwind: "$items" },
      { $group: { _id: "$items.materialId", materialName: { $first: "$items.materialName" }, totalQuantity: { $sum: "$items.quantity" } } },
      { $sort: { totalQuantity: -1 } },
      { $limit: 5 },
    ]),
    MaterialDistribution.find({ status: "ACTIVE" }).sort({ createdAt: -1 }).limit(10),
  ]);

  return {
    totalMaterials,
    totalStock: stockAgg[0]?.totalStock || 0,
    distributedToday: distributedToday[0]?.qty || 0,
    distributedThisMonth: distributedThisMonth[0]?.qty || 0,
    lowStockCount,
    outOfStockCount,
    mostDistributed: mostDistributed.map((m) => ({ materialId: String(m._id), materialName: m.materialName, totalQuantity: m.totalQuantity })),
    recentDistributions,
  };
}

// -------------------- Reports (§16) --------------------

function reportBaseFilter(req: Request): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  if (req.query.courseId) filter.courseId = req.query.courseId;
  if (req.query.batchId) filter.batchId = req.query.batchId;
  if (req.query.studentId) filter.studentId = req.query.studentId;
  if (req.query.dateFrom || req.query.dateTo) {
    filter.distributionDate = {
      ...(req.query.dateFrom ? { $gte: req.query.dateFrom } : {}),
      ...(req.query.dateTo ? { $lte: req.query.dateTo } : {}),
    };
  }
  return filter;
}

export async function stockReport(req: Request) {
  const filter: Record<string, unknown> = {};
  if (req.query.courseId) filter.courseId = req.query.courseId;
  if (req.query.materialType) filter.materialType = req.query.materialType;
  if (req.query.status) filter.status = req.query.status;
  const materials = await Material.find(filter).populate("courseId", "name").sort({ name: 1 });
  return materials.map((m) => ({
    materialId: String(m._id),
    name: m.name,
    materialType: m.materialType,
    courseName: (m.courseId as unknown as { name?: string })?.name,
    currentStock: m.currentStock,
    minimumStock: m.minimumStock,
    status: m.status,
    lowStock: m.currentStock > 0 && m.currentStock <= m.minimumStock,
    outOfStock: m.currentStock === 0,
  }));
}

export async function distributionReport(req: Request) {
  const { page, limit, skip } = parsePagination(req, { createdAt: -1 });
  const filter = reportBaseFilter(req);
  if (req.query.materialId) filter["items.materialId"] = new Types.ObjectId(req.query.materialId as string);

  const pipeline: PipelineStage[] = [
    { $match: filter },
    { $unwind: "$items" },
  ];
  if (req.query.materialId) pipeline.push({ $match: { "items.materialId": new Types.ObjectId(req.query.materialId as string) } });
  if (req.query.materialType) pipeline.push({ $match: { "items.materialType": req.query.materialType } });
  if (req.query.isPaid) pipeline.push({ $match: { "items.isPaid": req.query.isPaid === "true" } });

  const [rows, countRows] = await Promise.all([
    MaterialDistribution.aggregate([
      ...pipeline,
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          date: "$distributionDate",
          studentName: 1,
          studentRoll: 1,
          registrationId: 1,
          courseName: 1,
          batchName: 1,
          materialName: "$items.materialName",
          quantity: "$items.quantity",
          isPaid: "$items.isPaid",
          price: "$items.lineTotal",
          distributedBy: "$distributedByName",
        },
      },
    ]),
    MaterialDistribution.aggregate([...pipeline, { $count: "total" }]),
  ]);

  const total = countRows[0]?.total || 0;
  return { items: rows, meta: buildMeta(page, limit, total) };
}

export async function studentWiseReport(req: Request) {
  const filter = reportBaseFilter(req);
  const rows = await MaterialDistribution.aggregate<{
    _id: string;
    studentName: string;
    studentRoll?: string;
    courseName?: string;
    batchName?: string;
    totalMaterials: number;
    totalQuantity: number;
    totalPaidValue: number;
  }>([
    { $match: { ...filter, status: "ACTIVE" } },
    {
      $group: {
        _id: "$studentId",
        studentName: { $first: "$studentName" },
        studentRoll: { $first: "$studentRoll" },
        courseName: { $first: "$courseName" },
        batchName: { $first: "$batchName" },
        totalMaterials: { $sum: { $size: "$items" } },
        totalQuantity: { $sum: "$totalQuantity" },
        totalPaidValue: { $sum: "$totalPaidAmount" },
      },
    },
    { $sort: { studentName: 1 } },
  ]);
  return rows.map((r) => ({
    studentId: String(r._id),
    studentName: r.studentName,
    studentRoll: r.studentRoll,
    courseName: r.courseName,
    batchName: r.batchName,
    totalMaterials: r.totalMaterials,
    totalQuantity: r.totalQuantity,
    totalPaidValue: r.totalPaidValue,
  }));
}

export async function materialWiseReport(req: Request) {
  const filter: Record<string, unknown> = {};
  if (req.query.courseId) filter.courseId = req.query.courseId;
  if (req.query.materialType) filter.materialType = req.query.materialType;
  const materials = await Material.find(filter).select("name currentStock openingStock");

  const distributed = await StockMovement.aggregate<{ _id: string; totalDistributed: number }>([
    { $match: { movementType: "DISTRIBUTION" } },
    { $group: { _id: "$materialId", totalDistributed: { $sum: { $abs: "$quantity" } } } },
  ]);
  const distributedByMaterial = new Map(distributed.map((d) => [String(d._id), d.totalDistributed]));

  const totalIn = await StockMovement.aggregate<{ _id: string; totalIn: number }>([
    { $match: { movementType: "IN" } },
    { $group: { _id: "$materialId", totalIn: { $sum: "$quantity" } } },
  ]);
  const totalInByMaterial = new Map(totalIn.map((d) => [String(d._id), d.totalIn]));

  return materials.map((m) => {
    const id = String(m._id);
    const totalDistributed = distributedByMaterial.get(id) || 0;
    return {
      materialId: id,
      name: m.name,
      totalStock: totalInByMaterial.get(id) || m.openingStock,
      totalDistributed,
      remainingStock: m.currentStock,
    };
  });
}
