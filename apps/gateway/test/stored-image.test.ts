import { describe, expect, it } from "vitest";
import {
  createShortId,
  detectImageMime,
  mergeStoredImageMetadata,
  normalizeFilename,
  normalizeFolder,
  normalizeTags,
  parseStoredImagePatch,
  sanitizeFileBaseName,
} from "../src/stored-image";

describe("stored image policy", () => {
  it("removes traversal and unsafe filename characters", () => {
    expect(sanitizeFileBaseName("../../My Holiday <script>.PNG")).toBe(
      "my-holiday-script",
    );
  });

  it("creates an eight-character URL-safe image ID", () => {
    expect(createShortId(new Uint8Array([0, 0, 0, 0, 0, 0]))).toBe("AAAAAAAA");
    expect(createShortId(new Uint8Array([255, 255, 255, 255, 255, 255]))).toBe(
      "________",
    );
  });

  it("detects supported image signatures", () => {
    expect(
      detectImageMime(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe("image/png");
    expect(detectImageMime(new TextEncoder().encode("not-an-image"))).toBeNull();
  });

  it("normalizes names, tags, and folders", () => {
    expect(normalizeFilename("../../旅行照片 01.PNG")).toBe("旅行照片 01.PNG");
    expect(normalizeFilename("   ")).toBeNull();
    expect(normalizeTags([" Blog ", "作品", "blog"])).toEqual(["Blog", "作品"]);
    expect(normalizeTags([""])).toBeNull();
    expect(normalizeFolder("  作品  ")).toBe("作品");
    expect(normalizeFolder("nested/folder")).toBeNull();
    expect(normalizeFolder("x".repeat(81))).toBeNull();
  });

  it("parses and merges metadata without storage access", () => {
    const patch = parseStoredImagePatch({ addTags: ["New"], folder: "" });
    expect(patch.ok).toBe(true);
    if (!patch.ok) return;

    expect(
      mergeStoredImageMetadata(
        { tags: JSON.stringify(["Old"]), folder: "Archive" },
        patch.value,
      ),
    ).toEqual({
      ok: true,
      value: { tags: JSON.stringify(["Old", "New"]) },
    });
  });
});
