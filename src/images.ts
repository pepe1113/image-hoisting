import { error, json } from "./http";
import { requestProfileId, resolveImageProfile } from "./profiles";
import type { Env, ResolvedImageProfile } from "./types";

const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;
const R2_SCAN_LIMIT = 1000;
const MAX_FILENAME_LENGTH = 180;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 40;
const SHORT_ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const SHORT_ID_BYTES = 6;
const SHORT_ID_ATTEMPTS = 5;

const MIME_EXTENSIONS = {
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

type AllowedImageMime = keyof typeof MIME_EXTENSIONS;

interface ImageData {
  profileId: string;
  key: string;
  url: string;
  size: number;
  etag: string;
  contentType: string | null;
  originalName: string | null;
  filename: string;
  tags: string[];
  uploadedAt: string;
}

function isAllowedImageMime(value: string): value is AllowedImageMime {
  return Object.prototype.hasOwnProperty.call(MIME_EXTENSIONS, value);
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
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
  ) {
    return "image/png";
  }

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  if (bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(ascii(bytes, 0, 6))) {
    return "image/gif";
  }

  if (
    bytes.length >= 12 &&
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 4) === "WEBP"
  ) {
    return "image/webp";
  }

  if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp") {
    for (let offset = 8; offset + 4 <= bytes.length; offset += 4) {
      if (["avif", "avis"].includes(ascii(bytes, offset, 4))) {
        return "image/avif";
      }
    }
  }

  return null;
}

export function sanitizeFileBaseName(filename: string): string {
  const leaf = filename.replaceAll("\\", "/").split("/").at(-1) ?? "image";
  const withoutExtension = leaf.replace(/\.[^.]*$/, "");
  const normalized = withoutExtension
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLocaleLowerCase("en")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

  return Array.from(normalized || "image").slice(0, 60).join("");
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0)!;
    return codePoint <= 0x1f || codePoint === 0x7f;
  });
}

export function normalizeFilename(value: string): string | null {
  const filename = value.replaceAll("\\", "/").split("/").at(-1)?.normalize("NFKC").trim() ?? "";
  if (!filename || filename.length > MAX_FILENAME_LENGTH || hasControlCharacter(filename)) {
    return null;
  }
  return filename;
}

export function normalizeTags(values: string[]): string[] | null {
  if (values.length > MAX_TAGS) return null;

  const tags: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const tag = value.normalize("NFKC").trim();
    if (!tag || tag.length > MAX_TAG_LENGTH || hasControlCharacter(tag)) return null;
    const normalized = tag.toLocaleLowerCase("en");
    if (!seen.has(normalized)) {
      seen.add(normalized);
      tags.push(tag);
    }
  }
  return tags;
}

function storedTags(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || !parsed.every((tag) => typeof tag === "string")) return [];
    return normalizeTags(parsed) ?? [];
  } catch {
    return [];
  }
}

function imageData(object: R2Object, profile: ResolvedImageProfile): ImageData {
  const originalName = object.customMetadata?.originalName ?? null;
  const filename =
    normalizeFilename(object.customMetadata?.filename ?? originalName ?? "") ??
    object.key.split("/").at(-1) ??
    object.key;

  return {
    profileId: profile.id,
    key: object.key,
    url: publicUrl(profile.publicBaseUrl, object.key)!,
    size: object.size,
    etag: object.etag,
    contentType: object.httpMetadata?.contentType ?? null,
    originalName,
    filename,
    tags: storedTags(object.customMetadata?.tags),
    uploadedAt: object.customMetadata?.uploadedAt ?? object.uploaded.toISOString(),
  };
}

function matchesTags(image: ImageData, requestedTags: string[]): boolean {
  if (requestedTags.length === 0) return true;
  const imageTags = new Set(image.tags.map((tag) => tag.toLocaleLowerCase("en")));
  return requestedTags.every((tag) => imageTags.has(tag.toLocaleLowerCase("en")));
}

export function createShortId(bytes = crypto.getRandomValues(new Uint8Array(SHORT_ID_BYTES))): string {
  if (bytes.length !== SHORT_ID_BYTES) {
    throw new TypeError(`Short IDs require exactly ${SHORT_ID_BYTES} random bytes`);
  }

  let id = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const chunk = (bytes[index]! << 16) | (bytes[index + 1]! << 8) | bytes[index + 2]!;
    id += SHORT_ID_ALPHABET[(chunk >> 18) & 63];
    id += SHORT_ID_ALPHABET[(chunk >> 12) & 63];
    id += SHORT_ID_ALPHABET[(chunk >> 6) & 63];
    id += SHORT_ID_ALPHABET[chunk & 63];
  }
  return id;
}

async function createUniqueObjectKey(bucket: R2Bucket): Promise<string> {
  for (let attempt = 0; attempt < SHORT_ID_ATTEMPTS; attempt += 1) {
    const key = createShortId();
    if (!(await bucket.head(key))) return key;
  }
  throw new Error("Unable to allocate a unique image key");
}

function maxUploadBytes(env: Env): number {
  const configured = Number(env.MAX_UPLOAD_BYTES ?? DEFAULT_MAX_UPLOAD_BYTES);
  return Number.isSafeInteger(configured) && configured > 0
    ? configured
    : DEFAULT_MAX_UPLOAD_BYTES;
}

function publicUrl(publicBaseUrl: string, key: string): string | null {
  if (!publicBaseUrl) {
    return null;
  }

  try {
    const base = new URL(publicBaseUrl);
    if (
      !["http:", "https:"].includes(base.protocol) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash
    ) {
      return null;
    }
    const encodedKey = key.split("/").map(encodeURIComponent).join("/");
    return `${base.toString().replace(/\/$/, "")}/${encodedKey}`;
  } catch {
    return null;
  }
}

function validKey(key: string): boolean {
  const hasControlCharacter = Array.from(key).some((character) => {
    const codePoint = character.codePointAt(0)!;
    return codePoint <= 0x1f || codePoint === 0x7f;
  });

  return (
    key.length > 0 &&
    key.length <= 1024 &&
    !key.startsWith("/") &&
    !key.split("/").includes("..") &&
    !hasControlCharacter
  );
}

export async function serveImage(
  encodedKey: string,
  env: Env,
  headers: Headers,
  profileId = "default",
): Promise<Response> {
  const profile = resolveImageProfile(env, profileId);
  if (!profile) {
    return error("PROFILE_NOT_FOUND", "Image profile not found", 404, headers);
  }
  let key: string;
  try {
    key = decodeURIComponent(encodedKey);
  } catch {
    return error("INVALID_KEY", "The image key is invalid", 400, headers);
  }

  if (!validKey(key)) {
    return error("INVALID_KEY", "The image key is invalid", 400, headers);
  }

  const object = await profile.bucket.get(key);
  if (!object) {
    return error("IMAGE_NOT_FOUND", "Image not found", 404, headers);
  }

  const contentType = object.httpMetadata?.contentType?.trim().toLowerCase() ?? "";
  if (!isAllowedImageMime(contentType)) {
    return error(
      "UNSUPPORTED_MEDIA_TYPE",
      "The stored object is not a supported image",
      415,
      headers,
    );
  }

  const responseHeaders = new Headers(headers);
  responseHeaders.set("Content-Type", contentType);
  responseHeaders.set("Cache-Control", "public, max-age=0, must-revalidate");
  responseHeaders.set("Content-Security-Policy", "default-src 'none'; sandbox");
  responseHeaders.set("ETag", object.httpEtag);
  responseHeaders.set("X-Content-Type-Options", "nosniff");
  return new Response(object.body, { headers: responseHeaders });
}

export async function uploadImage(request: Request, env: Env, headers: Headers): Promise<Response> {
  const profile = resolveImageProfile(env, requestProfileId(request));
  if (!profile) {
    return error("PROFILE_NOT_FOUND", "Image profile not found", 404, headers);
  }
  const baseUrl = publicUrl(profile.publicBaseUrl, "health-check");
  if (!baseUrl) {
    return error("PUBLIC_URL_NOT_CONFIGURED", "PUBLIC_BASE_URL is missing or invalid", 503, headers);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error("INVALID_MULTIPART", "Expected multipart/form-data", 400, headers);
  }

  const value = form.get("file");
  if (!(value instanceof File)) {
    return error("FILE_REQUIRED", "The multipart field 'file' is required", 400, headers);
  }

  if (value.size === 0) {
    return error("EMPTY_FILE", "The uploaded file is empty", 400, headers);
  }

  const sizeLimit = maxUploadBytes(env);
  if (value.size > sizeLimit) {
    return error(
      "FILE_TOO_LARGE",
      `The uploaded file exceeds the ${sizeLimit} byte limit`,
      413,
      headers,
    );
  }

  const declaredMime = value.type.toLowerCase();
  const signature = new Uint8Array(await value.slice(0, 32).arrayBuffer());
  const detectedMime = detectImageMime(signature);
  if (!detectedMime) {
    return error(
      "UNSUPPORTED_MEDIA_TYPE",
      "The file contents are not a supported image",
      415,
      headers,
    );
  }

  const normalizedDeclaredMime =
    declaredMime === "image/jpg"
      ? "image/jpeg"
      : isAllowedImageMime(declaredMime)
        ? declaredMime
        : null;
  if (normalizedDeclaredMime && normalizedDeclaredMime !== detectedMime) {
    return error(
      "MIME_MISMATCH",
      "The file contents do not match the declared image type",
      415,
      headers,
    );
  }

  const uploadedAt = new Date();
  const key = await createUniqueObjectKey(profile.bucket);
  const url = publicUrl(profile.publicBaseUrl, key)!;
  const safeFilename = `${sanitizeFileBaseName(value.name)}.${MIME_EXTENSIONS[detectedMime]}`;
  const requestedFilename = form.get("filename");
  const originalName =
    normalizeFilename(typeof requestedFilename === "string" ? requestedFilename : value.name) ??
    safeFilename;
  const tags = normalizeTags(
    form
      .getAll("tag")
      .filter((tag): tag is string => typeof tag === "string"),
  );
  if (!tags) {
    return error(
      "INVALID_TAGS",
      `Provide at most ${MAX_TAGS} tags, each between 1 and ${MAX_TAG_LENGTH} characters`,
      400,
      headers,
    );
  }

  await profile.bucket.put(key, value.stream(), {
    httpMetadata: {
      contentType: detectedMime,
      cacheControl: "public, max-age=0, must-revalidate",
    },
    customMetadata: {
      originalName,
      filename: originalName,
      tags: JSON.stringify(tags),
      uploadedAt: uploadedAt.toISOString(),
    },
  });

  return json(
    {
      data: {
        profileId: profile.id,
        key,
        url,
        size: value.size,
        contentType: detectedMime,
        originalName,
        filename: originalName,
        tags,
        uploadedAt: uploadedAt.toISOString(),
      },
    },
    201,
    headers,
  );
}

export async function listImages(request: Request, env: Env, headers: Headers): Promise<Response> {
  const profile = resolveImageProfile(env, requestProfileId(request));
  if (!profile) {
    return error("PROFILE_NOT_FOUND", "Image profile not found", 404, headers);
  }
  if (!publicUrl(profile.publicBaseUrl, "health-check")) {
    return error("PUBLIC_URL_NOT_CONFIGURED", "PUBLIC_BASE_URL is missing or invalid", 503, headers);
  }

  const url = new URL(request.url);
  const requestedLimit = Number(url.searchParams.get("limit") ?? DEFAULT_LIST_LIMIT);
  const limit = Number.isInteger(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), MAX_LIST_LIMIT)
    : DEFAULT_LIST_LIMIT;
  const cursor = url.searchParams.get("cursor");
  const offset = cursor === null ? 0 : Number(cursor);
  const prefix = url.searchParams.get("prefix") || undefined;
  const requestedTags = normalizeTags(url.searchParams.getAll("tag"));

  if (prefix && (!validKey(prefix) || prefix.length > 256)) {
    return error("INVALID_PREFIX", "The list prefix is invalid", 400, headers);
  }
  if (!Number.isSafeInteger(offset) || offset < 0) {
    return error("INVALID_CURSOR", "The list cursor is invalid", 400, headers);
  }
  if (!requestedTags) {
    return error(
      "INVALID_TAGS",
      `Provide at most ${MAX_TAGS} tags, each between 1 and ${MAX_TAG_LENGTH} characters`,
      400,
      headers,
    );
  }

  const images: ImageData[] = [];
  let r2Cursor: string | undefined;
  let truncated: boolean;
  do {
    const result = await profile.bucket.list({
      limit: R2_SCAN_LIMIT,
      ...(r2Cursor ? { cursor: r2Cursor } : {}),
      ...(prefix ? { prefix } : {}),
      include: ["httpMetadata", "customMetadata"],
    });
    images.push(
      ...result.objects
        .map((object) => imageData(object, profile))
        .filter((image) => matchesTags(image, requestedTags)),
    );
    truncated = result.truncated;
    r2Cursor = result.truncated ? result.cursor : undefined;
  } while (truncated);

  images.sort((left, right) => {
    const dateDifference = Date.parse(right.uploadedAt) - Date.parse(left.uploadedAt);
    return dateDifference || left.key.localeCompare(right.key);
  });

  const page = images.slice(offset, offset + limit);
  const nextOffset = offset + page.length;
  const hasMore = nextOffset < images.length;

  return json(
    {
      data: page,
      pagination: {
        limit,
        truncated: hasMore,
        cursor: hasMore ? String(nextOffset) : null,
      },
    },
    200,
    headers,
  );
}

export async function updateImage(request: Request, env: Env, headers: Headers): Promise<Response> {
  const profile = resolveImageProfile(env, requestProfileId(request));
  if (!profile) {
    return error("PROFILE_NOT_FOUND", "Image profile not found", 404, headers);
  }
  const key = new URL(request.url).searchParams.get("key") ?? "";
  if (!validKey(key)) {
    return error("INVALID_KEY", "A valid image key is required", 400, headers);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return error("INVALID_JSON", "Expected a JSON request body", 400, headers);
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return error("INVALID_METADATA", "Expected filename or tags", 400, headers);
  }

  const metadata = payload as Record<string, unknown>;
  const hasFilename = Object.prototype.hasOwnProperty.call(metadata, "filename");
  const hasTags = Object.prototype.hasOwnProperty.call(metadata, "tags");
  if (!hasFilename && !hasTags) {
    return error("INVALID_METADATA", "Expected filename or tags", 400, headers);
  }

  const filename = hasFilename && typeof metadata.filename === "string"
    ? normalizeFilename(metadata.filename)
    : null;
  if (hasFilename && !filename) {
    return error(
      "INVALID_FILENAME",
      `Filename must be between 1 and ${MAX_FILENAME_LENGTH} characters`,
      400,
      headers,
    );
  }

  const tags =
    hasTags && Array.isArray(metadata.tags) && metadata.tags.every((tag) => typeof tag === "string")
      ? normalizeTags(metadata.tags)
      : null;
  if (hasTags && !tags) {
    return error(
      "INVALID_TAGS",
      `Provide at most ${MAX_TAGS} tags, each between 1 and ${MAX_TAG_LENGTH} characters`,
      400,
      headers,
    );
  }

  const object = await profile.bucket.get(key);
  if (!object) {
    return error("IMAGE_NOT_FOUND", "The image does not exist", 404, headers);
  }

  const customMetadata = {
    ...object.customMetadata,
    ...(filename ? { filename } : {}),
    ...(tags ? { tags: JSON.stringify(tags) } : {}),
  };
  const updated = await profile.bucket.put(key, object.body, {
    ...(object.httpMetadata ? { httpMetadata: object.httpMetadata } : {}),
    customMetadata,
  });

  return json({ data: imageData(updated, profile) }, 200, headers);
}

export async function deleteImage(request: Request, env: Env, headers: Headers): Promise<Response> {
  const profile = resolveImageProfile(env, requestProfileId(request));
  if (!profile) {
    return error("PROFILE_NOT_FOUND", "Image profile not found", 404, headers);
  }
  const key = new URL(request.url).searchParams.get("key") ?? "";
  if (!validKey(key)) {
    return error("INVALID_KEY", "A valid image key is required", 400, headers);
  }

  const existing = await profile.bucket.head(key);
  if (!existing) {
    return error("IMAGE_NOT_FOUND", "The image does not exist", 404, headers);
  }

  await profile.bucket.delete(key);
  return json({ data: { profileId: profile.id, key, deleted: true } }, 200, headers);
}
