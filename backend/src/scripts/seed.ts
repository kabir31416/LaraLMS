/**
 * Idempotent first-run seed: creates the three system roles (Phase 1 §8) and,
 * if none exists yet, one Admin user so there is a way to log in at all.
 * Run with `npm run seed` after `MONGO_URI` is configured.
 */
import { connectDB, disconnectDB } from "../config/db";
import { env } from "../config/env";
import { Role } from "../modules/rbac/role.model";
import { User } from "../modules/users/user.model";
import { PaymentMethod } from "../modules/paymentMethods/paymentMethod.model";
import { DEFAULT_ROLE_PERMISSIONS } from "../modules/rbac/permissions";
import { hashPassword } from "../common/utils/password";
import { logger } from "../logger/logger";

const DEFAULT_PAYMENT_METHODS = ["নগদ", "বিকাশ", "নগদ (মোবাইল)", "রকেট", "ব্যাংক", "অন্যান্য"];

async function seedRoles() {
  const roleDocs = new Map<string, string>();
  for (const [name, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    const role = await Role.findOneAndUpdate(
      { name },
      { $setOnInsert: { name, permissions, isSystem: true } },
      { upsert: true, new: true },
    );
    roleDocs.set(name, String(role._id));
    logger.info(`Role ready: ${name}`);
  }
  return roleDocs;
}

async function seedAdmin(adminRoleId: string) {
  const existingAdmin = await User.findOne({ roleId: adminRoleId });
  if (existingAdmin) {
    logger.info("An Admin user already exists — skipping admin seed.");
    return;
  }
  const passwordHash = await hashPassword(env.ADMIN_SEED_PASSWORD);
  await User.create({
    identifier: env.ADMIN_SEED_PHONE.toLowerCase(),
    passwordHash,
    roleId: adminRoleId,
    mustChangePassword: true,
  });
  logger.info(`Seeded first Admin user — identifier: ${env.ADMIN_SEED_PHONE} (change the password on first login).`);
}

/**
 * Only ever inserts when the collection is completely empty — never touches
 * an existing deployment's payment methods, even if an admin has since
 * renamed/deactivated/reordered the seeded defaults (Settings §33).
 */
async function seedPaymentMethods() {
  const count = await PaymentMethod.countDocuments();
  if (count > 0) {
    logger.info("Payment methods already exist — skipping seed.");
    return;
  }
  await PaymentMethod.insertMany(DEFAULT_PAYMENT_METHODS.map((name, i) => ({ name, displayOrder: i })));
  logger.info(`Seeded ${DEFAULT_PAYMENT_METHODS.length} default payment methods.`);
}

async function run() {
  await connectDB();
  const roles = await seedRoles();
  await seedAdmin(roles.get("admin")!);
  await seedPaymentMethods();
  await disconnectDB();
  logger.info("Seed complete.");
}

run().catch((err) => {
  logger.error({ err }, "Seed failed");
  process.exit(1);
});
