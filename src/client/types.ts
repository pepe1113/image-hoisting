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

export type Theme = "system" | "light" | "dark";
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

export type GalleryView = "grid" | "list";
export type ProcessingPreset = "high" | "standard" | "fast" | "custom";
export type SharpenLevel = "off" | "low" | "mid" | "high";
export type OutputFormat = "original" | "webp";
export type WorkspaceTab = "upload" | "history";

export interface ProfilePreferences {
  processingPreset: ProcessingPreset;
  maxDimension: number;
  quality: number;
  sharpen: SharpenLevel;
  outputFormat: OutputFormat;
  view: GalleryView;
}

export interface AppSettings {
  theme: Theme;
  activeProfileId: string;
  profiles: Record<string, ProfilePreferences>;
}

export interface PreparedImage {
  source: File;
  processed: File;
  sourceWidth: number | null;
  sourceHeight: number | null;
  outputWidth: number | null;
  outputHeight: number | null;
  scalePercent: number;
  savedPercent: number;
  processingMs: number;
  changed: boolean;
  warning: string;
}
