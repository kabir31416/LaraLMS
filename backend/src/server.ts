import { buildApp } from "./app";
import { connectDB, disconnectDB } from "./config/db";
import { env } from "./config/env";
import { logger } from "./logger/logger";
import { startBirthdayScheduler } from "./modules/sms/birthday.scheduler";

async function main() {
  await connectDB();
  const app = buildApp();

  const server = app.listen(env.PORT, () => {
    logger.info(`LaraLMS backend listening on port ${env.PORT} (${env.NODE_ENV})`);
  });

  // Birthday SMS §8 — only meaningful for this long-lived process (local
  // dev / non-Vercel hosting). The Vercel serverless deployment never keeps
  // this interval alive between invocations — it's covered instead by a
  // Vercel Cron Job hitting POST /sms/cron/birthday (see vercel.json).
  startBirthdayScheduler();

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    // Force-exit if graceful shutdown hangs.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal startup error:", err);
  process.exit(1);
});
