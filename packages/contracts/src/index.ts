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

export interface ApiErrorResponse {
  error: { code: string; message: string };
}

export interface DataResponse<T> {
  data: T;
}

export interface ImageProfile {
  id: string;
  label: string;
  isDefault: boolean;
}

export interface ImageRecord {
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
  width: number | null;
  height: number | null;
  folder: string | null;
}

export interface ImageList {
  data: ImageRecord[];
  summary: { total: number; totalBytes: number; folders: string[] };
  pagination: {
    cursor: string | null;
    truncated: boolean;
    limit: number;
    offset: number;
    total: number;
    totalBytes: number;
  };
}

export interface ImagePatch {
  filename?: string;
  tags?: string[];
  addTags?: string[];
  folder?: string;
}
