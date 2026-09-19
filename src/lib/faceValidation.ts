/**
 * Client-side face + basic image-quality checks for the Student Photo
 * Management feature (LaraLMS V1). This is deliberately NOT identity
 * verification — it only answers "is there one clear, usable face in this
 * photo?" using Google's MediaPipe Face Detector, a free, on-device (WASM)
 * model with no recurring API cost and no server round-trip. The WASM
 * runtime and the (~200KB) detector model are fetched once from Google's
 * public CDN on first use and cached by the browser afterward.
 *
 * The backend never trusts this check alone — it's a UX gate that lets a
 * student/admin fix a bad photo before spending an upload, not a security
 * boundary (file-type/size validation is enforced server-side regardless).
 */
import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";

const WASM_BASE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

export type FaceValidationReason =
  | "no-face"
  | "multiple-faces"
  | "face-too-small"
  | "face-off-center"
  | "too-blurry"
  | "too-dark";

export interface FaceValidationResult {
  ok: boolean;
  reason?: FaceValidationReason;
  faceCount: number;
}

let detectorPromise: Promise<FaceDetector> | null = null;

/** Lazily created once per page load and reused for every subsequent check (camera live-preview calls this many times per second). */
function getDetector(): Promise<FaceDetector> {
  if (!detectorPromise) {
    detectorPromise = FilesetResolver.forVisionTasks(WASM_BASE_URL).then((vision) =>
      FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: "IMAGE",
        minDetectionConfidence: 0.6,
      }),
    );
  }
  return detectorPromise;
}

/** Warms up the detector ahead of time (e.g. as soon as the camera dialog opens) so the first real check isn't slowed down by the model download. */
export function preloadFaceDetector(): void {
  getDetector().catch(() => { /* surfaced on the next real check instead */ });
}

const MIN_FACE_WIDTH_RATIO = 0.15; // face bounding box must be at least this wide relative to the whole frame
const MAX_CENTER_OFFSET_RATIO = 0.3; // face center must be within this fraction of the frame's half-width/height from the true center

/** Runs only the face-detection checks (no blur/darkness) — used for the camera's live "position your face" guidance, where speed matters more than the fuller checkQuality() below. */
export async function detectFace(source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement): Promise<FaceValidationResult> {
  const width = "videoWidth" in source ? source.videoWidth : source.width;
  const height = "videoHeight" in source ? source.videoHeight : source.height;
  if (!width || !height) return { ok: false, faceCount: 0 };

  const detector = await getDetector();
  const result = detector.detect(source);
  const faces = result.detections;

  if (faces.length === 0) return { ok: false, reason: "no-face", faceCount: 0 };
  if (faces.length > 1) return { ok: false, reason: "multiple-faces", faceCount: faces.length };

  const box = faces[0].boundingBox;
  if (!box) return { ok: false, reason: "no-face", faceCount: 1 };

  if (box.width / width < MIN_FACE_WIDTH_RATIO) return { ok: false, reason: "face-too-small", faceCount: 1 };

  const faceCenterX = box.originX + box.width / 2;
  const faceCenterY = box.originY + box.height / 2;
  const offsetX = Math.abs(faceCenterX - width / 2) / (width / 2);
  const offsetY = Math.abs(faceCenterY - height / 2) / (height / 2);
  if (offsetX > MAX_CENTER_OFFSET_RATIO || offsetY > MAX_CENTER_OFFSET_RATIO) {
    return { ok: false, reason: "face-off-center", faceCount: 1 };
  }

  return { ok: true, faceCount: 1 };
}

/** Downscales to a small canvas for fast pixel analysis — quality only needs to be roughly right, not exact, so this trades precision for speed. */
function getSampleImageData(source: HTMLImageElement | HTMLCanvasElement): ImageData {
  const SAMPLE_SIZE = 120;
  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  return ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
}

const DARKNESS_THRESHOLD = 40; // mean luminance (0-255) below this reads as "too dark to be useful"
const BLUR_VARIANCE_THRESHOLD = 18; // Laplacian-variance-style edge-strength floor — a genuinely sharp face photo clears this by a wide margin

/**
 * Simple, dependency-free heuristics — average luminance for darkness, and
 * a Laplacian-style edge-variance estimate for blur (a sharp photo has many
 * strong edges around eyes/nose/hairline; a blurry one is nearly flat).
 * Both are intentionally forgiving: this only needs to catch genuinely
 * unusable photos, not grade photography quality.
 */
export function checkImageQuality(source: HTMLImageElement | HTMLCanvasElement): { ok: boolean; reason?: "too-blurry" | "too-dark" } {
  const { data, width, height } = getSampleImageData(source);
  const gray = new Float32Array(width * height);
  let sum = 0;
  for (let i = 0; i < gray.length; i++) {
    const o = i * 4;
    const luminance = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
    gray[i] = luminance;
    sum += luminance;
  }
  const mean = sum / gray.length;
  if (mean < DARKNESS_THRESHOLD) return { ok: false, reason: "too-dark" };

  let laplacianSum = 0;
  let laplacianSumSq = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap = gray[i - 1] + gray[i + 1] + gray[i - width] + gray[i + width] - 4 * gray[i];
      laplacianSum += lap;
      laplacianSumSq += lap * lap;
      count++;
    }
  }
  const variance = laplacianSumSq / count - (laplacianSum / count) ** 2;
  if (variance < BLUR_VARIANCE_THRESHOLD) return { ok: false, reason: "too-blurry" };

  return { ok: true };
}

/** The full gate a photo must pass before crop/upload — face checks first (cheaper to explain to the user), then image-quality checks. */
export async function validatePhoto(source: HTMLImageElement | HTMLCanvasElement): Promise<FaceValidationResult> {
  const faceResult = await detectFace(source);
  if (!faceResult.ok) return faceResult;

  const quality = checkImageQuality(source);
  if (!quality.ok) return { ok: false, reason: quality.reason, faceCount: faceResult.faceCount };

  return faceResult;
}

export const FACE_VALIDATION_MESSAGES: Record<FaceValidationReason, string> = {
  "no-face": "মুখ শনাক্ত করা যায়নি। আপনার মুখ স্পষ্টভাবে দেখা যায় এমন একটি ছবি দিন।",
  "multiple-faces": "একাধিক মুখ শনাক্ত হয়েছে। শুধুমাত্র শিক্ষার্থীর মুখসহ একটি ছবি দিন।",
  "face-too-small": "মুখটি ছবিতে অনেক ছোট দেখাচ্ছে। কাছে থেকে তোলা একটি ছবি দিন।",
  "face-off-center": "মুখটি ফ্রেমের কেন্দ্রে রাখুন।",
  "too-blurry": "ছবিটি পরিষ্কার নয়। উজ্জ্বল ও স্পষ্ট একটি ছবি ব্যবহার করুন।",
  "too-dark": "ছবিটি যথেষ্ট উজ্জ্বল নয়। আরও ভালো আলোয় তোলা ছবি ব্যবহার করুন।",
};
