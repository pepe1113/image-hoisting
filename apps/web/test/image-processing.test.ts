import { expect, it, vi } from "vitest";
import { PROCESSING_PRESETS } from "../src/core";
import { prepareImage } from "../src/image-processing";
it("falls back to the main-thread canvas when image workers are unavailable", async () => {
  const close = vi.fn();
  vi.stubGlobal("Worker", undefined);
  vi.stubGlobal("OffscreenCanvas", undefined);
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 400, height: 300, close })));
  const canvas = document.createElement("canvas");
  const context = {
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 })),
    putImageData: vi.fn(),
  };
  vi.spyOn(canvas, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
  vi.spyOn(canvas, "toBlob").mockImplementation((callback) => {
    callback(new Blob(["webp"], { type: "image/webp" }));
  });
  vi.spyOn(document, "createElement").mockReturnValue(canvas);

  const result = await prepareImage(
    new File(["source"], "cover.png", { type: "image/png" }),
    { ...PROCESSING_PRESETS.fast, processingPreset: "fast" },
  );

  expect(result.changed).toBe(true);
  expect(result.outputWidth).toBe(400);
  expect(result.outputHeight).toBe(300);
  expect(result.processed.type).toBe("image/webp");
  expect(close).toHaveBeenCalledOnce();
  expect(canvas.width).toBe(0);
  expect(canvas.height).toBe(0);
});
