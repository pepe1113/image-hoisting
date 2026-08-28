/// <reference lib="webworker" />

import { calculateTargetSize } from "./core";
import {
  applyUnsharpMask,
  SHARPEN_AMOUNTS,
  type ImageProcessingRequest,
  type ImageWorkerResponse,
} from "./image-processing-core";

const worker = self as unknown as DedicatedWorkerGlobalScope;

worker.onmessage = async (event: MessageEvent<ImageProcessingRequest>) => {
  const startedAt = performance.now();
  let bitmap: ImageBitmap | null = null;
  let canvas: OffscreenCanvas | null = null;

  try {
    const { file, maxDimension, quality, sharpen } = event.data;
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const target = calculateTargetSize(bitmap.width, bitmap.height, maxDimension);
    canvas = new OffscreenCanvas(target.width, target.height);
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) throw new Error("OffscreenCanvas is unavailable");

    context.drawImage(bitmap, 0, 0, target.width, target.height);
    const amount = SHARPEN_AMOUNTS[sharpen];
    if (amount > 0) {
      const imageData = context.getImageData(0, 0, target.width, target.height);
      applyUnsharpMask(imageData.data, target.width, target.height, amount);
      context.putImageData(imageData, 0, 0);
    }

    const blob = await canvas.convertToBlob({
      type: "image/webp",
      quality: quality / 100,
    });
    const response: ImageWorkerResponse = {
      ok: true,
      result: {
        blob,
        sourceWidth: bitmap.width,
        sourceHeight: bitmap.height,
        outputWidth: target.width,
        outputHeight: target.height,
        processingMs: Math.max(0, Math.round(performance.now() - startedAt)),
      },
    };
    worker.postMessage(response);
  } catch (cause) {
    const response: ImageWorkerResponse = {
      ok: false,
      error: cause instanceof Error ? cause.message : "Image processing failed",
    };
    worker.postMessage(response);
  } finally {
    bitmap?.close();
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
};
