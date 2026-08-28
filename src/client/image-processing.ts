import {
  calculateTargetSize,
  extensionForFile,
  savedPercent,
  scalePercent,
} from "./core";
import {
  applyUnsharpMask,
  SHARPEN_AMOUNTS,
  type ImageProcessingRequest,
  type ImageProcessingResult,
  type ImageWorkerResponse,
} from "./image-processing-core";
import type { PreparedImage, ProfilePreferences } from "./types";

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("The browser could not create a WebP image."))),
      "image/webp",
      quality / 100,
    );
  });
}

async function imageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dimensions;
  } catch {
    return null;
  }
}

async function processOnMainThread(
  request: ImageProcessingRequest,
): Promise<ImageProcessingResult> {
  const startedAt = performance.now();
  let bitmap: ImageBitmap | null = null;
  let canvas: HTMLCanvasElement | null = null;

  try {
    bitmap = await createImageBitmap(request.file, { imageOrientation: "from-image" });
    const target = calculateTargetSize(bitmap.width, bitmap.height, request.maxDimension);
    canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) throw new Error("Canvas is unavailable");
    context.drawImage(bitmap, 0, 0, target.width, target.height);

    const amount = SHARPEN_AMOUNTS[request.sharpen];
    if (amount > 0) {
      const imageData = context.getImageData(0, 0, target.width, target.height);
      applyUnsharpMask(imageData.data, target.width, target.height, amount);
      context.putImageData(imageData, 0, 0);
    }

    return {
      blob: await canvasToBlob(canvas, request.quality),
      sourceWidth: bitmap.width,
      sourceHeight: bitmap.height,
      outputWidth: target.width,
      outputHeight: target.height,
      processingMs: Math.max(0, Math.round(performance.now() - startedAt)),
    };
  } finally {
    bitmap?.close();
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}

function processInWorker(request: ImageProcessingRequest): Promise<ImageProcessingResult> {
  return new Promise((resolve, reject) => {
    // ponytail: one worker per image; add a pool only if batch throughput becomes measurable.
    const worker = new Worker(new URL("./image-processing.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event: MessageEvent<ImageWorkerResponse>) => {
      worker.terminate();
      if (event.data.ok) resolve(event.data.result);
      else reject(new Error(event.data.error));
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error("The image worker stopped unexpectedly."));
    };
    worker.postMessage(request);
  });
}

async function processWebp(
  file: File,
  preferences: ProfilePreferences,
): Promise<ImageProcessingResult> {
  const request = {
    file,
    maxDimension: preferences.maxDimension,
    quality: preferences.quality,
    sharpen: preferences.sharpen,
  };
  if (typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined") {
    try {
      return await processInWorker(request);
    } catch {
      return processOnMainThread(request);
    }
  }
  return processOnMainThread(request);
}

export async function prepareImage(
  file: File,
  preferences: ProfilePreferences,
): Promise<PreparedImage> {
  if (file.type === "image/gif" || preferences.outputFormat === "original") {
    const startedAt = performance.now();
    const dimensions = await imageDimensions(file);
    return {
      source: file,
      processed: file,
      sourceWidth: dimensions?.width ?? null,
      sourceHeight: dimensions?.height ?? null,
      outputWidth: dimensions?.width ?? null,
      outputHeight: dimensions?.height ?? null,
      scalePercent: 100,
      savedPercent: 0,
      processingMs: Math.max(0, Math.round(performance.now() - startedAt)),
      changed: false,
      warning: file.type === "image/gif" ? "GIF stays in its original format to preserve animation." : "Original image selected.",
    };
  }

  try {
    const result = await processWebp(file, preferences);
    const base = file.name.replace(/\.[^.]*$/u, "") || "image";
    const processed = new File([result.blob], `${base}.webp`, {
      type: "image/webp",
      lastModified: Date.now(),
    });
    return {
      source: file,
      processed,
      sourceWidth: result.sourceWidth,
      sourceHeight: result.sourceHeight,
      outputWidth: result.outputWidth,
      outputHeight: result.outputHeight,
      scalePercent: scalePercent(
        Math.max(result.sourceWidth, result.sourceHeight),
        Math.max(result.outputWidth, result.outputHeight),
      ),
      savedPercent: savedPercent(file.size, processed.size),
      processingMs: result.processingMs,
      changed: true,
      warning: processed.size > file.size ? "The processed file is larger than the original." : "",
    };
  } catch {
    return {
      source: file,
      processed: file,
      sourceWidth: null,
      sourceHeight: null,
      outputWidth: null,
      outputHeight: null,
      scalePercent: 100,
      savedPercent: 0,
      processingMs: 0,
      changed: false,
      warning: `Image processing failed. The original ${extensionForFile(file).toUpperCase()} will be used.`,
    };
  }
}
