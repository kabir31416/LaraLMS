import { Student } from "../students/student.model";
import { SmsLog, SmsSettings, SmsSettingsDoc } from "./sms.model";
import { getSmsSettingsForApi, isEventEnabled, sendSms } from "./sms.service";
import { renderTemplate } from "./sms.template";
import * as guardianService from "../guardians/guardian.service";
import { logger } from "../../logger/logger";
import { getOrCreateSingleton } from "../../common/utils/singleton";

/**
 * Birthday SMS (SMS Provider Upgrade §8) — the ERP has no existing job
 * scheduler/automation infrastructure at all (confirmed by audit: no cron
 * package, no queue, nothing else in this codebase runs on a timer), so
 * this is the minimal backend/server-side mechanism that covers both ways
 * this app actually runs in production:
 *   - the traditional long-lived process (server.ts, local dev/non-Vercel
 *     hosting) — started once via startBirthdayScheduler()'s setInterval.
 *   - Vercel's serverless deployment (api/index.ts / vercel.json), which
 *     never keeps a process (or a setInterval) alive between requests —
 *     covered instead by a Vercel Cron Job hitting the dedicated
 *     POST /sms/cron/birthday route once a day (sms.routes.ts).
 * Both paths call this exact same runBirthdaySweep() — never two different
 * implementations of "who gets a birthday text today."
 *
 * Same day-and-month dob suffix match already used by student.service.ts's
 * birthdayToday Student List filter (`-MM-DD`, dob stored as "yyyy-mm-dd")
 * — reused here rather than reinvented.
 */
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

async function alreadySentToday(studentId: string, today: string): Promise<boolean> {
  return !!(await SmsLog.exists({ studentId, eventType: "birthday", sentForDate: today, status: "sent" }));
}

export async function runBirthdaySweep(): Promise<{ checked: number; sent: number; skipped: number }> {
  const today = todayDateString();

  if (!(await isEventEnabled("birthday"))) {
    return { checked: 0, sent: 0, skipped: 0 };
  }

  const now = new Date();
  const dobSuffix = new RegExp(`-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}$`);
  const students = await Student.find({ dob: dobSuffix, status: "সক্রিয়" });

  const settings = await getSmsSettingsForApi();
  let sent = 0;
  let skipped = 0;

  for (const student of students) {
    try {
      const studentId = String(student._id);
      // Per-student duplicate prevention (§8) — checked regardless of how
      // many times a day this sweep runs (multiple setInterval ticks, or a
      // Vercel Cron retry), so a student is never texted twice on the same
      // calendar day even across restarts.
      if (await alreadySentToday(studentId, today)) {
        skipped++;
        continue;
      }
      const guardian = await guardianService.getPrimary(studentId);
      if (!guardian?.phone) {
        skipped++;
        continue;
      }
      const message = renderTemplate(settings.templates.birthday, {
        studentName: student.name,
        registrationId: student.registrationId,
        roll: student.currentRollNumber || "",
        courseName: student.course || "",
        guardianName: guardian.name || "",
      });
      const result = await sendSms({ to: guardian.phone, message, eventType: "birthday", studentId });
      if (result.ok) sent++;
      else skipped++;
    } catch (err) {
      logger.error({ err, studentId: String(student._id) }, "Birthday SMS failed for one student — continuing sweep");
      skipped++;
    }
  }

  try {
    const doc: SmsSettingsDoc = await getOrCreateSingleton(SmsSettings, {} as SmsSettingsDoc);
    doc.birthdayLastRunDate = today;
    await doc.save();
  } catch (err) {
    logger.warn({ err }, "Failed to record birthdayLastRunDate — sweep itself still succeeded");
  }

  return { checked: students.length, sent, skipped };
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Traditional long-lived process only (server.ts) — never started from the
 * Vercel serverless entrypoint (api/index.ts), which would just leak a
 * timer with no guarantee it's ever ticked before the function is frozen.
 * A 30-minute check interval is cheap (most ticks short-circuit instantly
 * via birthdayLastRunDate) and still catches the day's birthdays promptly
 * after a restart.
 */
export function startBirthdayScheduler(): void {
  if (intervalHandle) return;
  const tick = async () => {
    try {
      const doc = await getOrCreateSingleton(SmsSettings, {} as SmsSettingsDoc);
      if (doc.birthdayLastRunDate === todayDateString()) return;
      const result = await runBirthdaySweep();
      logger.info(result, "Birthday SMS sweep completed");
    } catch (err) {
      logger.error({ err }, "Birthday SMS sweep tick failed");
    }
  };
  intervalHandle = setInterval(tick, 30 * 60 * 1000);
  intervalHandle.unref();
  void tick();
}
