export const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_TAGS = 20;
export const MAX_TAG_LENGTH = 40;

export interface WorkspaceLimits {
  maxUploadBytes: number;
  maxTags: number;
  maxTagLength: number;
}

export const DEFAULT_WORKSPACE_LIMITS: WorkspaceLimits = {
  maxUploadBytes: DEFAULT_MAX_UPLOAD_BYTES,
  maxTags: MAX_TAGS,
  maxTagLength: MAX_TAG_LENGTH,
};
