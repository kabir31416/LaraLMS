import { cloudinary, isCloudinaryConfigured } from "../../config/cloudinary";
import { ApiError } from "./ApiError";
import { logger } from "../../logger/logger";

const STUDENT_PHOTO_FOLDER = "laralms/students";

export interface UploadedPhoto {
  url: string;
  publicId: string;
}

/**
 * Uploads a student's profile photo to Cloudinary and returns only what
 * MongoDB is allowed to store — a secure URL and the public ID needed to
 * delete it later (Student Photo Management §1/§2). The buffer is expected
 * to already be a validated, cropped-to-1:1 image (student.routes.ts's
 * multer config + the frontend's crop/compress pipeline) — this function's
 * own `transformation` is a server-side backstop, not the only resize step,
 * so a well-behaved upload never actually needs it to do much work.
 *
 * `publicIdSeed` (the student's registrationId) makes the asset's name
 * traceable in the Cloudinary dashboard without a lookup — never used as a
 * security boundary, since Cloudinary public IDs aren't secret.
 */
export async function uploadStudentPhoto(buffer: Buffer, publicIdSeed: string): Promise<UploadedPhoto> {
  if (!isCloudinaryConfigured) {
    throw ApiError.internal("Photo storage is not configured — contact the site administrator");
  }

  const safeSeed = publicIdSeed.replace(/[^a-zA-Z0-9_-]/g, "_");
  const publicId = `${safeSeed}_${Date.now()}`;

  return new Promise<UploadedPhoto>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: STUDENT_PHOTO_FOLDER,
        public_id: publicId,
        overwrite: false,
        resource_type: "image",
        // Square 1:1, ~500px, auto-optimized delivery format/quality — the
        // frontend already crops to 1:1 and compresses before this call, so
        // this is a safety net for any client bug or a future non-browser
        // caller, not the primary place resizing happens (§3/§22).
        transformation: [{ width: 500, height: 500, crop: "fill", gravity: "face" }, { quality: "auto", fetch_format: "auto" }],
      },
      (error, result) => {
        if (error || !result) {
          reject(ApiError.internal("Photo upload to storage failed"));
          return;
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    stream.end(buffer);
  });
}

/**
 * Best-effort delete of a previous photo — called only after the new photo
 * has already been uploaded and saved (Student Photo Management §2's
 * "delete the old image only after the new upload succeeds"). Never throws:
 * a failed cleanup must not fail the student update that triggered it, it's
 * just logged for a human to notice and clean up manually if needed.
 */
export async function deleteCloudinaryAsset(publicId: string | undefined | null): Promise<void> {
  if (!publicId || !isCloudinaryConfigured) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  } catch (err) {
    logger.error({ err, publicId }, "Failed to delete old Cloudinary asset — leaving it in place");
  }
}
