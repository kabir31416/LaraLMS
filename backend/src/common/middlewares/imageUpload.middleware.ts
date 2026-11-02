import multer from "multer";
import { ApiError } from "../utils/ApiError";

/**
 * Shared multer config for a single profile-photo upload — same
 * memoryStorage + fileFilter pattern as studentImport.routes.ts's Excel
 * upload, just for images (Student Photo Management §3). The frontend
 * already crops to 1:1 and compresses to ~500px before sending, so a real
 * upload is only a few hundred KB; the limit here is a generous backstop
 * against an oversized/corrupt/malicious payload, never the primary size
 * control. Backend never trusts the frontend's own validation alone — a
 * crafted request skipping the browser pipeline still hits this filter.
 */
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const IMAGE_MIMETYPES = ["image/jpeg", "image/png", "image/webp"];

export const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB — comfortably above a compressed 500px photo, well short of a raw camera original
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf("."));
    const looksLikeImage = IMAGE_EXTENSIONS.includes(ext) && IMAGE_MIMETYPES.includes(file.mimetype);
    if (!looksLikeImage) return cb(new ApiError(400, "BAD_REQUEST", "শুধুমাত্র JPG, JPEG, PNG বা WEBP ছবি আপলোড করা যাবে।"));
    cb(null, true);
  },
});

/** Mess Management attachments — an image or a PDF invoice, max 5MB. */
const ATTACHMENT_EXTENSIONS = [...IMAGE_EXTENSIONS, ".pdf"];
const ATTACHMENT_MIMETYPES = [...IMAGE_MIMETYPES, "application/pdf"];

export const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf("."));
    const ok = ATTACHMENT_EXTENSIONS.includes(ext) && ATTACHMENT_MIMETYPES.includes(file.mimetype);
    if (!ok) return cb(new ApiError(400, "BAD_REQUEST", "শুধুমাত্র JPG, PNG, WEBP ছবি বা PDF ফাইল আপলোড করা যাবে (সর্বোচ্চ ৫MB)।"));
    cb(null, true);
  },
});
