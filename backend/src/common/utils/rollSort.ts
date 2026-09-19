/**
 * `Student.currentRollNumber` (Roll Number) is a free-text String field —
 * admin-entered or Excel-imported, sometimes with leading zeros, occasionally
 * non-numeric — so a plain Mongo `.sort({ currentRollNumber: 1 })` sorts
 * LEXICOGRAPHICALLY: "10" lands before "2". Every student roster in this app
 * must default to true ascending NUMERIC roll order instead. These helpers
 * never touch `registrationId` (the separate, permanent, system-generated
 * identity) — sorting is Roll-only, per the Registration ID vs Roll rule.
 */

import { PipelineStage, Model } from "mongoose";

const MISSING_ROLL_SORT_KEY = Number.MAX_SAFE_INTEGER;

function rollSortKeyStage(): PipelineStage {
  return {
    $addFields: {
      __rollSortKey: {
        $ifNull: [
          { $convert: { input: "$currentRollNumber", to: "double", onError: null, onNull: null } },
          MISSING_ROLL_SORT_KEY,
        ],
      },
    },
  };
}

/**
 * Returns just the `_id`s of one sorted+paginated page, in true numeric roll
 * order — missing/non-numeric rolls are always pushed to the very end,
 * regardless of ascending/descending direction. `name` is the tiebreaker for
 * equal/missing roll values, purely for a stable, deterministic order.
 * Mongo's own `.find({ _id: { $in: ... } })` would NOT preserve this order,
 * so pair this with `reorderByIds` below.
 */
export async function pageIdsByRoll(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: Model<any>,
  filter: Record<string, unknown>,
  order: 1 | -1,
  skip: number,
  limit: number,
): Promise<string[]> {
  const pipeline: PipelineStage[] = [
    { $match: filter },
    rollSortKeyStage(),
    { $sort: { __rollSortKey: order, name: 1 } },
    { $skip: skip },
    { $limit: limit },
    { $project: { _id: 1 } },
  ];
  const rows = await model.aggregate<{ _id: unknown }>(pipeline);
  return rows.map((r) => String(r._id));
}

/** Re-orders already-hydrated documents to match a specific `_id` order. */
export function reorderByIds<T extends { _id: unknown }>(docs: T[], orderedIds: string[]): T[] {
  const byId = new Map(docs.map((d) => [String(d._id), d]));
  return orderedIds.map((id) => byId.get(id)).filter((d): d is T => !!d);
}
