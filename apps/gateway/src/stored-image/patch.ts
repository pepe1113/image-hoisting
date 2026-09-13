import { MAX_TAG_LENGTH, MAX_TAGS } from "@image-hoisting/contracts";
import {
  MAX_FILENAME_LENGTH,
  MAX_FOLDER_LENGTH,
  normalizeFilename,
  normalizeFolder,
  normalizeTags,
  storedTags,
} from "./metadata";

export interface StoredImagePatch {
  filename?: string;
  tags?: string[];
  addTags?: string[];
  folder?: string;
  hasFolder: boolean;
}

export type PolicyResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: string; message: string };

function invalid<T>(code: string, message: string): PolicyResult<T> {
  return { ok: false, code, message };
}

export function parseStoredImagePatch(
  payload: unknown,
): PolicyResult<StoredImagePatch> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return invalid("INVALID_METADATA", "Expected filename or tags");
  }
  const metadata = payload as Record<string, unknown>;
  const hasFilename = Object.hasOwn(metadata, "filename");
  const hasTags = Object.hasOwn(metadata, "tags");
  const hasAddTags = Object.hasOwn(metadata, "addTags");
  const hasFolder = Object.hasOwn(metadata, "folder");
  if ((!hasFilename && !hasTags && !hasAddTags && !hasFolder) || (hasTags && hasAddTags)) {
    return invalid(
      "INVALID_METADATA",
      "Provide filename, tags, addTags or folder; tags and addTags cannot be combined",
    );
  }
  const filename =
    hasFilename && typeof metadata.filename === "string"
      ? normalizeFilename(metadata.filename)
      : null;
  if (hasFilename && !filename) {
    return invalid(
      "INVALID_FILENAME",
      `Filename must be between 1 and ${MAX_FILENAME_LENGTH} characters`,
    );
  }
  const tags =
    hasTags &&
    Array.isArray(metadata.tags) &&
    metadata.tags.every((tag) => typeof tag === "string")
      ? normalizeTags(metadata.tags)
      : null;
  if (hasTags && !tags) {
    return invalid(
      "INVALID_TAGS",
      `Provide at most ${MAX_TAGS} tags, each between 1 and ${MAX_TAG_LENGTH} characters`,
    );
  }
  const addTags =
    hasAddTags &&
    Array.isArray(metadata.addTags) &&
    metadata.addTags.every((tag) => typeof tag === "string")
      ? normalizeTags(metadata.addTags)
      : null;
  if (hasAddTags && (!addTags || addTags.length === 0)) {
    return invalid(
      "INVALID_TAGS",
      `Provide 1 to ${MAX_TAGS} tags, each at most ${MAX_TAG_LENGTH} characters`,
    );
  }
  const folder =
    hasFolder && typeof metadata.folder === "string"
      ? normalizeFolder(metadata.folder)
      : null;
  if (hasFolder && folder === null) {
    return invalid(
      "INVALID_FOLDER",
      `Folder names must be at most ${MAX_FOLDER_LENGTH} characters and cannot contain slashes`,
    );
  }
  return {
    ok: true,
    value: {
      ...(filename ? { filename } : {}),
      ...(tags ? { tags } : {}),
      ...(addTags ? { addTags } : {}),
      ...(folder !== null ? { folder } : {}),
      hasFolder,
    },
  };
}

export function mergeStoredImageMetadata(
  current: Record<string, string> | undefined,
  patch: StoredImagePatch,
): PolicyResult<Record<string, string>> {
  const existingTags = storedTags(current?.tags);
  const combinedTags = patch.addTags
    ? normalizeTags([
        ...existingTags,
        ...patch.addTags.filter(
          (tag) =>
            !existingTags.some(
              (existing) =>
                existing.toLocaleLowerCase("en") === tag.toLocaleLowerCase("en"),
            ),
        ),
      ])
    : patch.tags;
  if (patch.addTags && !combinedTags) {
    return invalid(
      "INVALID_TAGS",
      `The merged image tags would exceed ${MAX_TAGS} tags`,
    );
  }
  const metadata: Record<string, string> = {
    ...current,
    ...(patch.filename ? { filename: patch.filename } : {}),
    ...(combinedTags ? { tags: JSON.stringify(combinedTags) } : {}),
  };
  if (patch.hasFolder) {
    if (patch.folder) metadata.folder = patch.folder;
    else delete metadata.folder;
  }
  return { ok: true, value: metadata };
}
