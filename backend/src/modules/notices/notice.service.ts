import { Request } from "express";
import { Notice, NoticeDoc } from "./notice.model";
import { ApiError } from "../../common/utils/ApiError";
import { recordAudit } from "../../audit/auditLog.service";
import { buildMeta, parsePagination } from "../../common/utils/pagination";

export async function list(req: Request) {
  const { page, limit, skip, sort } = parsePagination(req, { pinned: -1, publishDate: -1 });
  const filter: Record<string, unknown> = {};
  if (req.query.type) filter.type = req.query.type;

  const [items, total] = await Promise.all([
    Notice.find(filter).sort(sort).skip(skip).limit(limit),
    Notice.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

async function getDocOrThrow(id: string): Promise<NoticeDoc> {
  const doc = await Notice.findById(id);
  if (!doc) throw ApiError.notFound("Notice not found");
  return doc;
}

export async function create(req: Request, data: Partial<NoticeDoc>): Promise<NoticeDoc> {
  const doc = await Notice.create(data);
  await recordAudit({ req, action: "notice.create", module: "notices", targetCollection: "notices", targetId: String(doc._id), after: doc.toObject() });
  return doc;
}

export async function update(req: Request, id: string, patch: Partial<NoticeDoc>): Promise<NoticeDoc> {
  const doc = await getDocOrThrow(id);
  const before = doc.toObject();
  Object.assign(doc, patch);
  await doc.save();
  await recordAudit({ req, action: "notice.update", module: "notices", targetCollection: "notices", targetId: id, before, after: doc.toObject() });
  return doc;
}

export async function togglePin(req: Request, id: string): Promise<NoticeDoc> {
  const doc = await getDocOrThrow(id);
  doc.pinned = !doc.pinned;
  await doc.save();
  await recordAudit({ req, action: "notice.toggle-pin", module: "notices", targetCollection: "notices", targetId: id, after: { pinned: doc.pinned } });
  return doc;
}

export async function remove(req: Request, id: string): Promise<void> {
  const doc = await getDocOrThrow(id);
  await doc.deleteOne();
  await recordAudit({ req, action: "notice.delete", module: "notices", targetCollection: "notices", targetId: id, before: doc.toObject() });
}
