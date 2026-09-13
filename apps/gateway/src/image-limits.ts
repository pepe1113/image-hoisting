import {
  DEFAULT_MAX_UPLOAD_BYTES,
  MAX_TAG_LENGTH,
  MAX_TAGS,
  type WorkspaceLimits,
} from "@image-hoisting/contracts";
import type { Env } from "./types";

export function maxUploadBytes(env: Env): number {
  const configured = Number(env.MAX_UPLOAD_BYTES ?? DEFAULT_MAX_UPLOAD_BYTES);
  return Number.isSafeInteger(configured) && configured > 0
    ? configured
    : DEFAULT_MAX_UPLOAD_BYTES;
}

export function workspaceLimits(env: Env): WorkspaceLimits {
  return {
    maxUploadBytes: maxUploadBytes(env),
    maxTags: MAX_TAGS,
    maxTagLength: MAX_TAG_LENGTH,
  };
}
