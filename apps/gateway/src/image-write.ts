import { MAX_TAG_LENGTH, MAX_TAGS } from "@image-hoisting/contracts";
import { error, json } from "./http";
import { readImageDimensions } from "./image-dimensions";
import { maxUploadBytes } from "./image-limits";
import { requestProfileId, resolveImageProfile } from "./profiles";
import {
  IMAGE_CACHE_CONTROL,
  createShortId,
  detectImageMime,
  imageExtension,
  isAllowedImageMime,
  mergeStoredImageMetadata,
  normalizeFilename,
  normalizeTags,
  parseStoredImagePatch,
  publicImageUrl,
  sanitizeFileBaseName,
  storedImageRecord,
  validImageKey,
} from "./stored-image";
import type { Env } from "./types";

const SHORT_ID_ATTEMPTS = 5;

async function createUniqueObjectKey(bucket: R2Bucket): Promise<string> {
  for (let attempt = 0; attempt < SHORT_ID_ATTEMPTS; attempt += 1) {
    const key = createShortId();
    if (!(await bucket.head(key))) return key;
  }
  throw new Error("Unable to allocate a unique image key");
}

export async function uploadImage(
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

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return error("INVALID_MULTIPART", "Expected multipart/form-data", 400, headers);
  }

  const value = form.get("file");
  if (!(value instanceof File)) {
    return error(
      "FILE_REQUIRED",
      "The multipart field 'file' is required",
      400,
      headers,
    );
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
  const url = publicImageUrl(profile.publicBaseUrl, key)!;
  const safeFilename = `${sanitizeFileBaseName(value.name)}.${imageExtension(detectedMime)}`;
  const requestedFilename = form.get("filename");
  const originalName =
    normalizeFilename(
      typeof requestedFilename === "string" ? requestedFilename : value.name,
    ) ?? safeFilename;
  const tags = normalizeTags(
    form.getAll("tag").filter((tag): tag is string => typeof tag === "string"),
  );
  if (!tags) {
    return error(
      "INVALID_TAGS",
      `Provide at most ${MAX_TAGS} tags, each between 1 and ${MAX_TAG_LENGTH} characters`,
      400,
      headers,
    );
  }

  // ponytail: inspect at most 256 KiB; expand only if supported metadata moves later.
  const dimensions = readImageDimensions(
    new Uint8Array(await value.slice(0, 256 * 1024).arrayBuffer()),
    detectedMime,
  );
  await profile.bucket.put(key, value.stream(), {
    httpMetadata: {
      contentType: detectedMime,
      cacheControl: IMAGE_CACHE_CONTROL,
    },
    customMetadata: {
      originalName,
      filename: originalName,
      tags: JSON.stringify(tags),
      uploadedAt: uploadedAt.toISOString(),
      ...(dimensions
        ? { width: String(dimensions.width), height: String(dimensions.height) }
        : {}),
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
        width: dimensions?.width ?? null,
        height: dimensions?.height ?? null,
        folder: null,
      },
    },
    201,
    headers,
  );
}

export async function updateImage(
  request: Request,
  env: Env,
  headers: Headers,
): Promise<Response> {
  const profile = resolveImageProfile(env, requestProfileId(request));
  if (!profile) {
    return error("PROFILE_NOT_FOUND", "Image profile not found", 404, headers);
  }
  const key = new URL(request.url).searchParams.get("key") ?? "";
  if (!validImageKey(key)) {
    return error("INVALID_KEY", "A valid image key is required", 400, headers);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return error("INVALID_JSON", "Expected a JSON request body", 400, headers);
  }
  const patch = parseStoredImagePatch(payload);
  if (!patch.ok) return error(patch.code, patch.message, 400, headers);

  const object = await profile.bucket.get(key);
  if (!object) {
    return error("IMAGE_NOT_FOUND", "The image does not exist", 404, headers);
  }
  const metadata = mergeStoredImageMetadata(object.customMetadata, patch.value);
  if (!metadata.ok) {
    await object.body.cancel();
    return error(metadata.code, metadata.message, 400, headers);
  }

  const updated = await profile.bucket.put(key, object.body, {
    ...(object.httpMetadata ? { httpMetadata: object.httpMetadata } : {}),
    customMetadata: metadata.value,
  });
  return json({ data: storedImageRecord(updated, profile) }, 200, headers);
}

export async function deleteImage(
  request: Request,
  env: Env,
  headers: Headers,
): Promise<Response> {
  const profile = resolveImageProfile(env, requestProfileId(request));
  if (!profile) {
    return error("PROFILE_NOT_FOUND", "Image profile not found", 404, headers);
  }
  const key = new URL(request.url).searchParams.get("key") ?? "";
  if (!validImageKey(key)) {
    return error("INVALID_KEY", "A valid image key is required", 400, headers);
  }

  const existing = await profile.bucket.head(key);
  if (!existing) {
    return error("IMAGE_NOT_FOUND", "The image does not exist", 404, headers);
  }

  await profile.bucket.delete(key);
  return json({ data: { profileId: profile.id, key, deleted: true } }, 200, headers);
}
