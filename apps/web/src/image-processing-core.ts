import type { SharpenLevel } from "./types";

export const SHARPEN_AMOUNTS: Record<SharpenLevel, number> = {
  off: 0,
  low: 0.2,
  mid: 0.4,
  high: 0.7,
};

export interface ImageProcessingResult {
  blob: Blob;
  sourceWidth: number;
  sourceHeight: number;
  outputWidth: number;
  outputHeight: number;
  processingMs: number;
}

export interface ImageProcessingRequest {
  file: File;
  maxDimension: number;
  quality: number;
  sharpen: SharpenLevel;
}

export type ImageWorkerResponse =
  | { ok: true; result: ImageProcessingResult }
  | { ok: false; error: string };

export function applyUnsharpMask(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  amount: number,
): void {
  if (amount <= 0 || width < 1 || height < 1) return;
  const stride = width * 4;
  let previous: Uint8ClampedArray | null = null;
  let current = new Uint8ClampedArray(pixels.subarray(0, stride));
  let next = height > 1
    ? new Uint8ClampedArray(pixels.subarray(stride, stride * 2))
    : null;

  for (let y = 0; y < height; y += 1) {
    const rows = [previous, current, next].filter(
      (row): row is Uint8ClampedArray => row !== null,
    );
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        let sum = 0;
        let samples = 0;
        for (const row of rows) {
          for (let sampleX = Math.max(0, x - 1); sampleX <= Math.min(width - 1, x + 1); sampleX += 1) {
            sum += row[sampleX * 4 + channel]!;
            samples += 1;
          }
        }
        const original = current[x * 4 + channel]!;
        pixels[offset + channel] = Math.round(original + amount * (original - sum / samples));
      }
    }
    previous = current;
    current = next ?? current;
    next = y + 2 < height
      ? new Uint8ClampedArray(pixels.subarray((y + 2) * stride, (y + 3) * stride))
      : null;
  }
}
