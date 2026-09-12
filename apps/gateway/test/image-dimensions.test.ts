import { describe, expect, it } from "vitest";
import { readImageDimensions } from "../src/image-dimensions";

const text = (value: string) => [...new TextEncoder().encode(value)];
const u32 = (value: number) => [value >>> 24, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
const box = (type: string, data: number[]) => [...u32(data.length + 8), ...text(type), ...data];
const webp = (type: string, data: number[]) => new Uint8Array([
  ...text("RIFF"), data.length + 12, 0, 0, 0, ...text("WEBP"), ...text(type), data.length, 0, 0, 0, ...data,
]);

export const PNG_DIMENSIONS = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, ...u32(13), ...text("IHDR"), ...u32(640), ...u32(480), 8, 2, 0, 0, 0, 0, 0, 0, 0,
]);
const avif = new Uint8Array([
  ...box("ftyp", [...text("avif"), 0, 0, 0, 0]),
  ...box("meta", [0, 0, 0, 0,
    ...box("pitm", [0, 0, 0, 0, 0, 2]),
    ...box("iprp", [
      ...box("ipco", [
        ...box("ispe", [0, 0, 0, 0, ...u32(32), ...u32(24)]),
        ...box("ispe", [0, 0, 0, 0, ...u32(640), ...u32(480)]),
      ]),
      ...box("ipma", [0, 0, 0, 0, ...u32(2), 0, 1, 1, 1, 0, 2, 1, 2]),
    ]),
  ]),
]);

describe("container image dimensions", () => {
  it("reads the supported formats including progressive JPEG and all WebP variants", () => {
    const jpeg = new Uint8Array([255, 216, 255, 224, 0, 4, 0, 0, 255, 194, 0, 11, 8, 1, 224, 2, 128, 1, 1, 17, 0]);
    const gif = new Uint8Array([...text("GIF89a"), 128, 2, 224, 1, 0, 0, 0]);
    const lossless = ((480 - 1) << 14) | (640 - 1);
    for (const [mime, bytes] of [
      ["image/png", PNG_DIMENSIONS], ["image/jpeg", jpeg], ["image/gif", gif], ["image/avif", avif],
      ["image/webp", webp("VP8X", [0, 0, 0, 0, 127, 2, 0, 223, 1, 0])],
      ["image/webp", webp("VP8L", [47, lossless & 255, (lossless >>> 8) & 255, (lossless >>> 16) & 255, lossless >>> 24])],
      ["image/webp", webp("VP8 ", [0, 0, 0, 157, 1, 42, 128, 2, 224, 1])],
    ] as const) {
      expect(readImageDimensions(bytes, mime)).toEqual({ width: 640, height: 480 });
    }
  });

  it("returns unknown for truncation, invalid sizes and an unassociated AVIF property", () => {
    for (const mime of ["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"]) {
      for (let length = 0; length < 20; length += 1) {
        expect(() => readImageDimensions(new Uint8Array(length).fill(255), mime)).not.toThrow();
      }
    }
    for (let end = 0; end < avif.length; end += 1) expect(readImageDimensions(avif.slice(0, end), "image/avif")).toBeNull();
    const unknownPrimary = avif.slice();
    unknownPrimary[unknownPrimary.length - 2] = 0;
    expect(readImageDimensions(unknownPrimary, "image/avif")).toBeNull();
    const zeroWidth = PNG_DIMENSIONS.slice();
    zeroWidth.fill(0, 16, 20);
    expect(readImageDimensions(zeroWidth, "image/png")).toBeNull();
    expect(readImageDimensions(webp("VP8X", [0]), "image/webp")).toBeNull();
  });
});
