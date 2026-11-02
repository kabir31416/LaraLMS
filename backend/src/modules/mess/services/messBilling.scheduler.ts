import { logger } from "../../../logger/logger";
import { recordAudit } from "../../../audit/auditLog.service";
import { localToday } from "../../../common/utils/localDate";
import { Mess } from "../models/mess.model";
import { getMessSettings } from "./messSettings.service";
import { runBillGeneration } from "./messBilling.service";
import { sendDueReminders } from "./messSms.service";

/**
 * Mandatory monthly Mess billing — backend-only, never dependent on anyone
 * opening a page.
 *
 * WHEN: on each active Mess's billing day (Mess.billingDay, else Mess
 * Settings billingDay, default 1) in the institution's timezone
 * (APP_TIMEZONE, default Asia/Dhaka), for the CURRENT month. If the server
 * was down on that day, the first tick afterwards in the same month catches
 * up (day >= billingDay).
 *
 * ONCE: each Mess's month is claimed atomically (`autoBilledPeriod`) before
 * generating, so the long-lived interval, a Vercel Cron call and a second
 * server instance can all fire and only one generates. Underneath that, bill
 * creation itself is idempotent (unique {membershipId, periodKey}) — a
 * manual "generate" run uses the very same runBillGeneration() and can never
 * duplicate what the scheduler made. If a run throws (e.g. database down)
 * the claim is released so the next tick retries; per-member failures are
 * recorded in autoBillingLastRun and shown on the Mess dashboard for a manual
 * re-run (which only fills the gaps).
 *
 * Also sends the automatic due-reminder SMS on the due day (when enabled),
 * claimed the same way so it goes out once per Mess per month.
 *
 * TWO RUNNERS, ONE SWEEP:
 *  - long-lived process (server.ts): startMessBillingScheduler() — 30-min interval
 *  - Vercel serverless: Vercel Cron → GET /api/v1/mess/cron/monthly-billing
 *    (Bearer CRON_SECRET), see backend/vercel.json
 */

export interface MessSweepRow {
  messId: string;
  messName: string;
  action: "billed" | "not_due_yet" | "already_billed" | "claimed_elsewhere" | "error";
  created?: number;
  skippedExisting?: number;
  failed?: number;
  error?: string;
}

export interface MessSweepResult {
  today: string;
  period: string;
  autoBillingEnabled: boolean;
  messes: MessSweepRow[];
  dueReminders: { messId: string; sent: number; failed: number; skipped: number }[];
}

/** Pure: should this Mess's bills for the current month be generated now? (on/after the billing day, once per month). */
export function isBillingDue(today: string, billingDay: number, lastBilledPeriod?: string | null): boolean {
  const period = today.slice(0, 7);
  const day = Number(today.slice(8, 10));
  return day >= Math.min(28, Math.max(1, billingDay || 1)) && lastBilledPeriod !== period;
}

export async function runMonthlyBillingSweep(trigger: "interval" | "cron" | "startup" = "interval"): Promise<MessSweepResult> {
  const settings = await getMessSettings();
  const today = localToday();
  const period = today.slice(0, 7);
  const day = Number(today.slice(8, 10));
  const result: MessSweepResult = { today, period, autoBillingEnabled: settings.autoBillingEnabled, messes: [], dueReminders: [] };
  const messes = await Mess.find({ status: "active" }).select("name billingDay dueDay autoBilledPeriod dueReminderPeriod").lean();

  if (settings.autoBillingEnabled) {
    for (const mess of messes) {
      const row: MessSweepRow = { messId: String(mess._id), messName: mess.name, action: "billed" };
      const billingDay = mess.billingDay ?? settings.billingDay ?? 1;
      if (!isBillingDue(today, billingDay, mess.autoBilledPeriod)) {
        result.messes.push({ ...row, action: mess.autoBilledPeriod === period ? "already_billed" : "not_due_yet" });
        continue;
      }
      const claimed = await Mess.findOneAndUpdate({ _id: mess._id, autoBilledPeriod: { $ne: period } }, { $set: { autoBilledPeriod: period } }, { new: false })
        .select("autoBilledPeriod")
        .lean();
      if (!claimed) {
        result.messes.push({ ...row, action: "claimed_elsewhere" });
        continue;
      }
      try {
        const r = await runBillGeneration({ source: "auto" }, { period, messId: String(mess._id) });
        await Mess.updateOne(
          { _id: mess._id },
          { $set: { autoBillingLastRun: { period, at: new Date(), trigger, eligible: r.eligible, created: r.created, skippedExisting: r.skippedExisting, failed: r.failed.length } } },
        );
        result.messes.push({ ...row, created: r.created, skippedExisting: r.skippedExisting, failed: r.failed.length });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        logger.error({ err, messId: String(mess._id), period }, "Mess auto billing failed — claim released for retry");
        await Mess.updateOne(
          { _id: mess._id, autoBilledPeriod: period },
          {
            ...(claimed.autoBilledPeriod ? { $set: { autoBilledPeriod: claimed.autoBilledPeriod } } : { $unset: { autoBilledPeriod: "" } }),
          },
        );
        await Mess.updateOne({ _id: mess._id }, { $set: { autoBillingLastRun: { period, at: new Date(), trigger, eligible: 0, created: 0, skippedExisting: 0, failed: 0, error: message } } });
        result.messes.push({ ...row, action: "error", error: message });
      }
    }
  }

  if (settings.dueReminderSmsEnabled) {
    for (const mess of messes) {
      const dueDay = mess.dueDay ?? settings.dueDay ?? 10;
      if (day < dueDay || mess.dueReminderPeriod === period) continue;
      const claimed = await Mess.findOneAndUpdate({ _id: mess._id, dueReminderPeriod: { $ne: period } }, { $set: { dueReminderPeriod: period } });
      if (!claimed) continue;
      try {
        const r = await sendDueReminders({ messIds: [mess._id as never], mode: "auto" });
        result.dueReminders.push({ messId: String(mess._id), sent: r.sent, failed: r.failed, skipped: r.skipped });
      } catch (err) {
        logger.error({ err, messId: String(mess._id) }, "Mess due reminder sweep failed");
      }
    }
  }

  const billed = result.messes.filter((m) => m.action === "billed" || m.action === "error");
  if (billed.length || result.dueReminders.length) {
    await recordAudit({ action: "mess.scheduler.run", module: "mess", targetCollection: "messbills", after: { trigger, today, period, messes: billed, dueReminders: result.dueReminders } });
  }
  return result;
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

/** Long-lived process only (server.ts) — the Vercel deployment uses the cron route instead. */
export function startMessBillingScheduler(): void {
  if (intervalHandle) return;
  let running = false;
  const tick = async (trigger: "interval" | "startup") => {
    if (running) return;
    running = true;
    try {
      const r = await runMonthlyBillingSweep(trigger);
      const worked = r.messes.filter((m) => m.action === "billed" || m.action === "error");
      if (worked.length || r.dueReminders.length) logger.info({ period: r.period, messes: worked, dueReminders: r.dueReminders }, "Mess monthly billing sweep");
    } catch (err) {
      logger.error({ err }, "Mess monthly billing tick failed");
    } finally {
      running = false;
    }
  };
  intervalHandle = setInterval(() => void tick("interval"), 30 * 60 * 1000);
  intervalHandle.unref();
  // Shortly after start-up, so a restart on the billing day bills straight away.
  setTimeout(() => void tick("startup"), 15_000).unref();
}
