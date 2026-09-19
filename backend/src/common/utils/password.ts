import bcrypt from "bcryptjs";
import { env } from "../../config/env";

/**
 * The ONE normalization rule for a User login identifier (phone/username) —
 * used identically at create time, reset time, and login time. A mismatch
 * between these (e.g. one trimming whitespace and the other not) is exactly
 * the class of bug that makes an objectively-correct identifier/password
 * pair fail to match its own stored record.
 */
export function normalizeIdentifier(raw: string): string {
  return raw.trim().toLowerCase();
}

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
