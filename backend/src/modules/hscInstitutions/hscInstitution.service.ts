import { Request } from "express";
import { HscInstitution, HscInstitutionDoc } from "./hscInstitution.model";
import { buildMeta, buildSearchFilter, parsePagination } from "../../common/utils/pagination";

/** Trim + collapse internal whitespace — the same normalization applied before both the lookup key and the stored display name, so "  Rajshahi   College " and "Rajshahi College" are always the same institution. */
function normalize(rawName: string): { name: string; normalizedName: string } {
  const name = rawName.trim().replace(/\s+/g, " ");
  return { name, normalizedName: name.toLowerCase() };
}

export async function list(req: Request) {
  const { page, limit, skip, sort } = parsePagination(req, { name: 1 });
  const filter = buildSearchFilter(req.query.search, ["name"]);
  const [items, total] = await Promise.all([
    HscInstitution.find(filter).sort(sort).skip(skip).limit(limit),
    HscInstitution.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

/**
 * Find-or-create by normalized name, atomically — used by student.service.ts
 * whenever a Student is created/updated with an `hscInstitution` value (§5-§8
 * of the spec: "do not create duplicate institution records", and for bulk
 * import specifically "create/associate only when that row is approved",
 * which this satisfies for free since it's only ever called from inside
 * student.service.ts's create()/applyPatch(), never from the import
 * preview/validation step).
 *
 * `findOneAndUpdate` with `upsert` is a single atomic operation, so two
 * concurrent admissions naming the same brand-new institution (e.g. two
 * bulk-import rows being approved back to back) can never create two
 * records for it — whichever request loses the race just gets back the
 * winner's already-inserted document instead of a duplicate-key error.
 */
export async function getOrCreateByName(rawName: string): Promise<HscInstitutionDoc> {
  const { name, normalizedName } = normalize(rawName);
  return HscInstitution.findOneAndUpdate(
    { normalizedName },
    { $setOnInsert: { name, normalizedName } },
    { upsert: true, new: true },
  );
}

/** Exact-but-case/whitespace-insensitive existence check — used by the bulk-import row validator to warn (not block) when a row's HSC institution isn't yet in the master data (§8). */
export async function existsByName(rawName: string): Promise<boolean> {
  const { normalizedName } = normalize(rawName);
  return !!(await HscInstitution.exists({ normalizedName }));
}
