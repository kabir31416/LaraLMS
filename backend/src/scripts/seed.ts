/**
 * Idempotent first-run seed: creates the three system roles (Phase 1 §8) and,
 * if none exists yet, one Admin user so there is a way to log in at all.
 * Run with `npm run seed` after `MONGO_URI` is configured.
 */
import { connectDB, disconnectDB } from "../config/db";
import { env } from "../config/env";
import { Role } from "../modules/rbac/role.model";
import { User } from "../modules/users/user.model";
import { DEFAULT_ROLE_PERMISSIONS } from "../modules/rbac/permissions";
import { hashPassword } from "../common/utils/password";
import { logger } from "../logger/logger";

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

async function run() {
  await connectDB();
  const roles = await seedRoles();
  await seedAdmin(roles.get("admin")!);
  await disconnectDB();
  logger.info("Seed complete.");
}

run().catch((err) => {
  logger.error({ err }, "Seed failed");
  process.exit(1);
});
