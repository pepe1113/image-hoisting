import { type ImageRecord, MAX_TAG_LENGTH, MAX_TAGS } from "@image-hoisting/contracts";
import { error, json } from "./http";
import { requestProfileId, resolveImageProfile } from "./profiles";
import {
  IMAGE_CACHE_CONTROL,
  MAX_FOLDER_LENGTH,
  isAllowedImageMime,
  matchesStoredImageTags,
  normalizeFolder,
  normalizeTags,
  publicImageUrl,
  storedImageRecord,
  validImageKey,
} from "./stored-image";
import type { Env, ResolvedImageProfile } from "./types";

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;
const R2_SCAN_LIMIT = 1000;

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
  if (!validImageKey(key)) {
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
  responseHeaders.set("Cache-Control", IMAGE_CACHE_CONTROL);
  responseHeaders.set("Cloudflare-CDN-Cache-Control", IMAGE_CACHE_CONTROL);
  responseHeaders.set("Content-Security-Policy", "default-src 'none'; sandbox");
  responseHeaders.set("ETag", object.httpEtag);
  responseHeaders.set("X-Content-Type-Options", "nosniff");
  return new Response(object.body, { headers: responseHeaders });
}

function listLimit(url: URL): number {
  const requested = Number(url.searchParams.get("limit") ?? DEFAULT_LIST_LIMIT);
  return Number.isInteger(requested)
    ? Math.min(Math.max(requested, 1), MAX_LIST_LIMIT)
    : DEFAULT_LIST_LIMIT;
}

async function allImages(
  bucket: R2Bucket,
  profile: ResolvedImageProfile,
): Promise<ImageRecord[]> {
  const images: ImageRecord[] = [];
  let cursor: string | undefined;
  let truncated: boolean;
  do {
    const result = await bucket.list({
      limit: R2_SCAN_LIMIT,
      ...(cursor ? { cursor } : {}),
      include: ["httpMetadata", "customMetadata"],
    });
    images.push(...result.objects.map((object) => storedImageRecord(object, profile)));
    truncated = result.truncated;
    cursor = result.truncated ? result.cursor : undefined;
  } while (truncated);
  return images;
}

export async function listImages(
  request: Request,
  env: Env,
  headers: Headers,
): Promise<Response> {
  const profile = resolveImageProfile(env, requestProfileId(request));
  if (!profile) {
    return error("PROFILE_NOT_FOUND", "Image profile not found", 404, headers);
  }
  if (!publicImageUrl(profile.publicBaseUrl, "health-check")) {
    return error(
      "PUBLIC_URL_NOT_CONFIGURED",
      "PUBLIC_BASE_URL is missing or invalid",
      503,
      headers,
    );
  }

  const url = new URL(request.url);
  const limit = listLimit(url);
  const cursor = url.searchParams.get("cursor");
  const offset = cursor === null ? 0 : Number(cursor);
  const prefix = url.searchParams.get("prefix") || undefined;
  const requestedTags = normalizeTags(url.searchParams.getAll("tag"));
  const requestedFolder = url.searchParams.has("folder")
    ? normalizeFolder(url.searchParams.get("folder") ?? "")
    : undefined;

  if (prefix && (!validImageKey(prefix) || prefix.length > 256)) {
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
  if (requestedFolder === null) {
    return error(
      "INVALID_FOLDER",
      `Folder names must be at most ${MAX_FOLDER_LENGTH} characters and cannot contain slashes`,
      400,
      headers,
    );
  }

  const images = await allImages(profile.bucket, profile);
  images.sort((left, right) => {
    const dateDifference = Date.parse(right.uploadedAt) - Date.parse(left.uploadedAt);
    return dateDifference || left.key.localeCompare(right.key);
  });

  const filtered = images.filter(
    (image) =>
      (!prefix || image.key.startsWith(prefix)) &&
      (requestedFolder === undefined || (image.folder ?? "") === requestedFolder) &&
      matchesStoredImageTags(image, requestedTags),
  );
  const lastPageOffset = Math.max(0, Math.ceil(filtered.length / limit) - 1) * limit;
  const pageOffset = offset < filtered.length ? offset : lastPageOffset;
  const page = filtered.slice(pageOffset, pageOffset + limit);
  const nextOffset = pageOffset + page.length;
  const hasMore = nextOffset < filtered.length;

  return json(
    {
      data: page,
      summary: {
        total: images.length,
        totalBytes: images.reduce((total, image) => total + image.size, 0),
        folders: [
          ...new Set(images.flatMap((image) => (image.folder ? [image.folder] : []))),
        ].sort((left, right) => left.localeCompare(right)),
      },
      pagination: {
        limit,
        offset: pageOffset,
        total: filtered.length,
        totalBytes: filtered.reduce((total, image) => total + image.size, 0),
        truncated: hasMore,
        cursor: hasMore ? String(nextOffset) : null,
      },
    },
    200,
    headers,
  );
}
