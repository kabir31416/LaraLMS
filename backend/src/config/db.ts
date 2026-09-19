import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "../logger/logger";

mongoose.set("strictQuery", true);

/**
 * Serverless-safe connect (Vercel's api/index.ts calls this on every
 * invocation): the readyState check reuses an already-open connection
 * across warm invocations of the same function instance instead of
 * reconnecting every time. When a connection attempt is already in flight
 * — two invocations landing on the same warm instance back to back during
 * a cold start — both await the SAME promise instead of one silently
 * returning early (as a boolean "isConnecting" flag would) before the
 * connection is actually ready.
 */
let connectionPromise: Promise<typeof mongoose> | null = null;

export async function connectDB(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(env.MONGO_URI, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
      })
      .then((conn) => {
        logger.info("MongoDB connected");
        return conn;
      })
      .catch((err) => {
        connectionPromise = null; // let the next invocation retry cleanly instead of staying wedged on a dead promise
        logger.error({ err }, "MongoDB connection failed");
        throw err;
      });
  }

  await connectionPromise;
}

export async function disconnectDB(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  connectionPromise = null;
}