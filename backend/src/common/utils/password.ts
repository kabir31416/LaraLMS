import bcrypt from "bcryptjs";
import { env } from "../../config/env";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.BCRYPT_SALT_ROUNDS);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Short, human-typeable temp password for admin-created accounts (Phase 2 §13). */
export function generateTempPassword(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase() + Math.floor(1000 + Math.random() * 9000);
}
