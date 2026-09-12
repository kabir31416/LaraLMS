import { Request } from "express";
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../../config/constants";

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  sort: Record<string, 1 | -1>;
}

/**
 * Shared pagination + sorting parser for every list endpoint.
 * Query params: ?page=&limit=&sortBy=&sortOrder=asc|desc
 */
export function parsePagination(req: Request, defaultSort: Record<string, 1 | -1> = { createdAt: -1 }): PaginationParams {
  const page = Math.max(1, Number(req.query.page) || DEFAULT_PAGE);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(req.query.limit) || DEFAULT_PAGE_SIZE));
  const skip = (page - 1) * limit;

  let sort = defaultSort;
  if (typeof req.query.sortBy === "string" && req.query.sortBy.trim()) {
    const order = req.query.sortOrder === "desc" ? -1 : 1;
    sort = { [req.query.sortBy]: order };
  }

  return { page, limit, skip, sort };
}

export function buildMeta(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

/**
 * Builds a case-insensitive $or regex search filter across the given fields.
 * Callers must pass only fields safe for regex search (no free-text injection of operators).
 */
export function buildSearchFilter(search: unknown, fields: string[]): Record<string, unknown> {
  if (typeof search !== "string" || !search.trim()) return {};
  const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escaped, "i");
  return { $or: fields.map((f) => ({ [f]: regex })) };
}
