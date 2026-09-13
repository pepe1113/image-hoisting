const MIME_EXTENSIONS = {
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type AllowedImageMime = keyof typeof MIME_EXTENSIONS;

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

export function isAllowedImageMime(value: string): value is AllowedImageMime {
  return Object.hasOwn(MIME_EXTENSIONS, value);
}

export function imageExtension(mime: AllowedImageMime): string {
  return MIME_EXTENSIONS[mime];
}

export function detectImageMime(bytes: Uint8Array): AllowedImageMime | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    ascii(bytes, 1, 3) === "PNG" &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) return "image/png";
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) return "image/jpeg";
  if (bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(ascii(bytes, 0, 6))) {
    return "image/gif";
  }
  if (
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 4) === "WEBP"
  ) return "image/webp";
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp") {
    for (let offset = 8; offset + 4 <= bytes.length; offset += 4) {
      if (["avif", "avis"].includes(ascii(bytes, offset, 4))) {
        return "image/avif";
      }
    }
  }
  return null;
}
