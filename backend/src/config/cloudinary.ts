import { v2 as cloudinary } from "cloudinary";
import { env } from "./env";

/**
 * Configured once at import time, same pattern as db.ts's mongoose.connect —
 * every caller just imports { cloudinary } and uses it, never re-configures.
 * CLOUDINARY_API_SECRET never leaves this process: the SDK only reads it
 * here, server-side, to sign upload/delete requests — it is never sent to
 * or readable by the frontend (Student Photo Management §2).
 */
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME || undefined,
  api_key: env.CLOUDINARY_API_KEY || undefined,
  api_secret: env.CLOUDINARY_API_SECRET || undefined,
  secure: true,
});

export const isCloudinaryConfigured = Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);

export { cloudinary };
