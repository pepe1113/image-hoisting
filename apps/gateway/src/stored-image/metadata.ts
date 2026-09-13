import { MAX_TAG_LENGTH, MAX_TAGS, type ImageRecord } from "@image-hoisting/contracts";
import type { ResolvedImageProfile } from "../types";

export const MAX_FILENAME_LENGTH = 180;
export const MAX_FOLDER_LENGTH = 80;
export const IMAGE_CACHE_CONTROL = "public, max-age=0, must-revalidate";
const SHORT_ID_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const SHORT_ID_BYTES = 6;

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0)!;
    return codePoint <= 0x1f || codePoint === 0x7f;
  });
}

export function sanitizeFileBaseName(filename: string): string {
  const leaf = filename.replaceAll("\\", "/").split("/").at(-1) ?? "image";
  const normalized = leaf
    .replace(/\.[^.]*$/, "")
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLocaleLowerCase("en")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return Array.from(normalized || "image").slice(0, 60).join("");
}

export function normalizeFilename(value: string): string | null {
  const filename =
    value.replaceAll("\\", "/").split("/").at(-1)?.normalize("NFKC").trim() ?? "";
  if (
    !filename ||
    filename.length > MAX_FILENAME_LENGTH ||
    hasControlCharacter(filename)
  ) return null;
  return filename;
}

export function normalizeTags(values: string[]): string[] | null {
  if (values.length > MAX_TAGS) return null;
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const tag = value.normalize("NFKC").trim();
    if (!tag || tag.length > MAX_TAG_LENGTH || hasControlCharacter(tag)) {
      return null;
    }
    const normalized = tag.toLocaleLowerCase("en");
    if (!seen.has(normalized)) {
      seen.add(normalized);
      tags.push(tag);
    }
  }
  return tags;
}

export function normalizeFolder(value: string): string | null {
  const folder = value.normalize("NFKC").trim();
  if (
    folder.length > MAX_FOLDER_LENGTH ||
    folder.includes("/") ||
    hasControlCharacter(folder)
  ) return null;
  return folder;
}

export function storedTags(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || !parsed.every((tag) => typeof tag === "string")) {
      return [];
    }
    return normalizeTags(parsed) ?? [];
  } catch {
    return [];
  }
}

export function publicImageUrl(baseUrl: string, key: string): string | null {
  if (!baseUrl) return null;
  try {
    const base = new URL(baseUrl);
    if (
      !["http:", "https:"].includes(base.protocol) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash
    ) return null;
    const encodedKey = key.split("/").map(encodeURIComponent).join("/");
    return `${base.toString().replace(/\/$/, "")}/${encodedKey}`;
  } catch {
    return null;
  }
}

export function validImageKey(key: string): boolean {
  return (
    key.length > 0 &&
    key.length <= 1024 &&
    !key.startsWith("/") &&
    !key.split("/").includes("..") &&
    !hasControlCharacter(key)
  );
}

export function storedImageRecord(
  object: R2Object,
  profile: ResolvedImageProfile,
): ImageRecord {
  const originalName = object.customMetadata?.originalName ?? null;
  const filename =
    normalizeFilename(object.customMetadata?.filename ?? originalName ?? "") ??
    object.key.split("/").at(-1) ??
    object.key;
  const width = Number(object.customMetadata?.width);
  const height = Number(object.customMetadata?.height);
  const hasDimensions = [width, height].every(
    (value) => Number.isInteger(value) && value > 0 && value <= 0x7fffffff,
  );
  return {
    profileId: profile.id,
    key: object.key,
    url: publicImageUrl(profile.publicBaseUrl, object.key)!,
    size: object.size,
    etag: object.etag,
    contentType: object.httpMetadata?.contentType ?? null,
    originalName,
    filename,
    tags: storedTags(object.customMetadata?.tags),
    uploadedAt: object.customMetadata?.uploadedAt ?? object.uploaded.toISOString(),
    width: hasDimensions ? width : null,
    height: hasDimensions ? height : null,
    folder: normalizeFolder(object.customMetadata?.folder ?? "") || null,
  };
}

export function matchesStoredImageTags(
  image: ImageRecord,
  requestedTags: string[],
): boolean {
  if (requestedTags.length === 0) return true;
  const imageTags = new Set(image.tags.map((tag) => tag.toLocaleLowerCase("en")));
  return requestedTags.every((tag) =>
    imageTags.has(tag.toLocaleLowerCase("en")),
  );
}

export function createShortId(
  bytes = crypto.getRandomValues(new Uint8Array(SHORT_ID_BYTES)),
): string {
  if (bytes.length !== SHORT_ID_BYTES) {
    throw new TypeError(`Short IDs require exactly ${SHORT_ID_BYTES} random bytes`);
  }
  let id = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const chunk =
      (bytes[index]! << 16) | (bytes[index + 1]! << 8) | bytes[index + 2]!;
    id += SHORT_ID_ALPHABET[(chunk >> 18) & 63];
    id += SHORT_ID_ALPHABET[(chunk >> 12) & 63];
    id += SHORT_ID_ALPHABET[(chunk >> 6) & 63];
    id += SHORT_ID_ALPHABET[chunk & 63];
  }
  return id;
}
