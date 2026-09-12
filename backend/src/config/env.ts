import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  MONGO_URI: z.string().min(1, "MONGO_URI is required"),

  JWT_ACCESS_SECRET: z.string().min(1, "JWT_ACCESS_SECRET is required"),
  JWT_REFRESH_SECRET: z.string().min(1, "JWT_REFRESH_SECRET is required"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),

  CORS_ORIGIN: z.string().default("http://localhost:5173"),

  CLOUDINARY_CLOUD_NAME: z.string().optional().default(""),
  CLOUDINARY_API_KEY: z.string().optional().default(""),
  CLOUDINARY_API_SECRET: z.string().optional().default(""),

  BCRYPT_SALT_ROUNDS: z.coerce.number().default(12),

  ADMIN_SEED_PHONE: z.string().optional().default("01700000000"),
  ADMIN_SEED_PASSWORD: z.string().optional().default("ChangeMe123!"),
  ADMIN_SEED_NAME: z.string().optional().default("Admin"),

  // BulkSMSBD (or compatible) gateway for login-credential SMS. Left blank,
  // sendSms() no-ops (logs and returns) instead of failing — SMS is a
  // best-effort side effect, never something that should block a student
  // being created or a login being (re)set.
  SMS_API_KEY: z.string().optional().default(""),
  SMS_SENDER_ID: z.string().optional().default(""),
  SMS_API_URL: z.string().optional().default("http://bulksmsbd.net/api/smsapi"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration — check backend/.env against .env.example");
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
