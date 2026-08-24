import {
  calculateTargetSize,
  extensionForFile,
  savedPercent,
  scalePercent,
} from "./core";
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

export async function prepareImage(
  file: File,
  preferences: ProfilePreferences,
): Promise<PreparedImage> {
  if (file.type === "image/gif" || preferences.resizePreset === "original") {
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
      changed: false,
      warning: file.type === "image/gif" ? "GIF stays in its original format to preserve animation." : "Original image selected.",
    };
  }

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const sourceWidth = bitmap.width;
    const sourceHeight = bitmap.height;
    const target = calculateTargetSize(sourceWidth, sourceHeight, preferences.maxDimension);
    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) throw new Error("Canvas is unavailable");
    context.drawImage(bitmap, 0, 0, target.width, target.height);
    bitmap.close();

    const blob = await canvasToBlob(canvas, preferences.quality);
    const base = file.name.replace(/\.[^.]*$/u, "") || "image";
    const processed = new File([blob], `${base}.webp`, {
      type: "image/webp",
      lastModified: Date.now(),
    });
    return {
      source: file,
      processed,
      sourceWidth,
      sourceHeight,
      outputWidth: target.width,
      outputHeight: target.height,
      scalePercent: scalePercent(Math.max(sourceWidth, sourceHeight), Math.max(target.width, target.height)),
      savedPercent: savedPercent(file.size, processed.size),
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
      changed: false,
      warning: `Image processing failed. The original ${extensionForFile(file).toUpperCase()} will be used.`,
    };
  }
}
