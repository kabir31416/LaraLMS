import { Request } from "express";
import { MaterialType, MaterialTypeDoc } from "./materialType.model";
import { ApiError } from "../../common/utils/ApiError";
import { recordAudit } from "../../audit/auditLog.service";
import { buildMeta, buildSearchFilter, parsePagination } from "../../common/utils/pagination";

export async function list(req: Request) {
  const { page, limit, skip, sort } = parsePagination(req, { displayOrder: 1, name: 1 });
  const filter = buildSearchFilter(req.query.search, ["name"]);
  const [items, total] = await Promise.all([
    MaterialType.find(filter).sort(sort).skip(skip).limit(limit),
    MaterialType.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

export async function create(req: Request, data: Pick<MaterialTypeDoc, "name"> & Partial<Pick<MaterialTypeDoc, "status" | "displayOrder">>) {
  const doc = await MaterialType.create(data);
  await recordAudit({ req, action: "material-type.create", module: "materials", targetCollection: "materialtypes", targetId: String(doc._id), after: doc.toObject() });
  return doc;
}

export async function update(req: Request, id: string, patch: Partial<Pick<MaterialTypeDoc, "name" | "status" | "displayOrder">>) {
  const doc = await MaterialType.findById(id);
  if (!doc) throw ApiError.notFound("Material type not found");
  const before = doc.toObject();
  Object.assign(doc, patch);
  await doc.save();
  await recordAudit({ req, action: "material-type.update", module: "materials", targetCollection: "materialtypes", targetId: id, before, after: doc.toObject() });
  return doc;
}

/** Never hard-delete a type that's already used historically (§2) — deactivate it instead. */
export async function remove(req: Request, id: string) {
  const doc = await MaterialType.findById(id);
  if (!doc) throw ApiError.notFound("Material type not found");
  const { Material } = await import("../materials/material.model");
  if (await Material.exists({ materialType: doc.name })) {
    throw ApiError.conflict("এই ধরনের ম্যাটেরিয়াল ইতিমধ্যে ব্যবহৃত হয়েছে — মুছে ফেলার বদলে নিষ্ক্রিয় করুন");
  }
  await doc.deleteOne();
  await recordAudit({ req, action: "material-type.delete", module: "materials", targetCollection: "materialtypes", targetId: id, before: doc.toObject() });
}

/** Used by material.service.ts instead of a hard-coded enum — rejects an unknown or deactivated type name outright, never silently creates one from free text. */
export async function assertActiveType(name: string): Promise<void> {
  const exists = await MaterialType.exists({ name, status: "সক্রিয়" });
  if (!exists) throw ApiError.badRequest("অবৈধ বা নিষ্ক্রিয় ম্যাটেরিয়াল টাইপ");
}
