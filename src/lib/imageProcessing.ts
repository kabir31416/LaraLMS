/**
 * Small canvas-based helpers shared by CameraCapture and PhotoCropper —
 * load a File/Blob as an <img>, crop+resize to a square canvas, and export
 * a compressed Blob. No image-editing library needed for this (Student
 * Photo Management §22): a fixed 1:1 output at a modest size is a couple of
 * canvas calls, not a general-purpose editor.
 */

export const OUTPUT_SIZE = 500; // final photo is OUTPUT_SIZE x OUTPUT_SIZE px
const JPEG_QUALITY = 0.85;
const WEBP_QUALITY = 0.85;

export function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Invalid image file"));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}

/**
 * Tries WebP first (smaller, and what most current browsers support); if
 * the browser silently ignores the requested type (older Safari falls back
 * to PNG), re-encodes as JPEG instead so the file is still compressed
 * rather than a large, uncompressed PNG.
 */
async function encodeCompressed(canvas: HTMLCanvasElement): Promise<Blob> {
  const webp = await canvasToBlob(canvas, "image/webp", WEBP_QUALITY);
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await canvasToBlob(canvas, "image/jpeg", JPEG_QUALITY);
  if (jpeg) return jpeg;
  throw new Error("Could not encode image");
}

export interface CropPixels {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Crops `area` (in source-image pixel coordinates, as react-easy-crop reports it) out of `image` and resizes it to a fixed OUTPUT_SIZE square, then compresses it. */
export async function cropAndResizeImage(image: HTMLImageElement, area: CropPixels): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  return encodeCompressed(canvas);
}

/** For a camera capture, which is already framed square by CameraCapture's own video-cropping — no separate crop step needed before this. */
export async function resizeSquareCanvas(source: HTMLCanvasElement): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(source, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  return encodeCompressed(canvas);
}
