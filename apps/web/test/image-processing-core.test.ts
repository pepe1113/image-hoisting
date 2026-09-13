import { expect, it } from "vitest";
import { PROCESSING_PRESETS } from "../src/core";
import { applyUnsharpMask, SHARPEN_AMOUNTS } from "../src/image-processing-core";
it("maps presets and sharpens contrast without changing alpha", () => {
  expect(PROCESSING_PRESETS.standard).toEqual({
    maxDimension: 1600,
    quality: 80,
    sharpen: "low",
    outputFormat: "webp",
  });
  expect(SHARPEN_AMOUNTS).toEqual({ off: 0, low: 0.2, mid: 0.4, high: 0.7 });
  const pixels = new Uint8ClampedArray([
    50, 50, 50, 255, 50, 50, 50, 255, 50, 50, 50, 255,
    50, 50, 50, 255, 100, 100, 100, 128, 50, 50, 50, 255,
    50, 50, 50, 255, 50, 50, 50, 255, 50, 50, 50, 255,
  ]);
  applyUnsharpMask(pixels, 3, 3, 0.7);
  expect(pixels[16]).toBeGreaterThan(100);
  expect(pixels[19]).toBe(128);
});
