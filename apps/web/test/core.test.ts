import { expect, it } from "vitest";
import { DEFAULT_SETTINGS, calculateTargetSize, formatBytes, generatedFilename, markdownForImage, parseSettings, parseTagInput, savedPercent, scalePercent } from "../src/core";
it("calculates resize and file-saving percentages", () => {
  expect(calculateTargetSize(4000, 3000, 1920)).toEqual({
    width: 1920,
    height: 1440,
    resized: true,
  });
  expect(calculateTargetSize(1200, 800, 1920)).toEqual({
    width: 1200,
    height: 800,
    resized: false,
  });
  expect(scalePercent(4000, 1920)).toBe(48);
  expect(savedPercent(1000, 370)).toBe(63);
  expect(savedPercent(1000, 1120)).toBe(-12);
});

it("formats sizes, tags, Markdown alt text, and random filenames", () => {
  expect(formatBytes(1536)).toBe("1.5 KiB");
  expect(parseTagInput(" Blog, 作品，blog ")).toEqual(["Blog", "作品"]);
  expect(markdownForImage({ filename: "cover-image.webp", url: "https://img.test/id" })).toBe(
    "![cover-image](https://img.test/id)",
  );
  expect(generatedFilename("webp", new Uint8Array(8))).toBe("aaaaaaaa.webp");
});

it("validates stored settings", () => {
  expect(parseSettings(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
  expect(parseSettings({
    ...DEFAULT_SETTINGS,
    profiles: {
      default: {
        processingPreset: "custom",
        maxDimension: 200,
        quality: 85,
        sharpen: "off",
        outputFormat: "webp",
        view: "grid",
      },
    },
  })).toBeNull();
  expect(parseSettings({
    theme: "dark",
    activeProfileId: "default",
    profiles: {
      default: { resizePreset: "original", maxDimension: 1920, quality: 85, view: "list" },
    },
  })).toBeNull();
});
