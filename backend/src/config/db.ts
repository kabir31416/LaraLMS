import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "../logger/logger";

mongoose.set("strictQuery", true);

/**
 * Mongoose never syncs a collection's real indexes to match the schema on
 * its own — a unique index created manually, or left over from an earlier
 * schema iteration, stays in the database forever until something acts on
 * it. If the `users` collection ever ended up with an extra unique index
 * (on anything besides `identifier`, which is the only field this schema
 * declares unique today), *every* new document sharing the same missing/
 * null value for that other field would collide under it — surfacing as
 * "already exists" for a brand-new, genuinely-unused identifier. Logging
 * the indexes on every startup makes that immediately visible, and
 * syncIndexes() safely aligns the database to exactly what user.model.ts
 * currently declares (dropping anything the schema no longer defines,
 * creating anything it newly needs) — it can never invent a new unique
 * constraint on its own, only enforce the one the schema already states.
 */
async function auditAndSyncUserIndexes(): Promise<void> {
  try {
    const { User } = await import("../modules/users/user.model");
    const before = await User.collection.indexes();
    logger.info({ indexes: before }, "users collection indexes — before sync");
    await User.syncIndexes();
    const after = await User.collection.indexes();
    logger.info({ indexes: after }, "users collection indexes — after sync (aligned to current schema)");
  } catch (err) {
    logger.error({ err }, "failed to audit/sync users collection indexes — continuing without blocking startup");
  }
}

export async function connectDB(): Promise<void> {
  mongoose.connection.on("connected", () => logger.info("MongoDB connected"));
  mongoose.connection.on("error", (err) => logger.error({ err }, "MongoDB connection error"));
  mongoose.connection.on("disconnected", () => logger.warn("MongoDB disconnected"));

  await mongoose.connect(env.MONGO_URI);
  await auditAndSyncUserIndexes();
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}
