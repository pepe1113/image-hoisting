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
}

export type Theme = "system" | "light" | "dark";
export type GalleryView = "grid" | "list";
export type ResizePreset = "original" | "large" | "medium" | "custom";
export type WorkspaceTab = "upload" | "history";

export interface ProfilePreferences {
  resizePreset: ResizePreset;
  maxDimension: number;
  quality: number;
  view: GalleryView;
}

export interface AppSettings {
  version: 1;
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
  changed: boolean;
  warning: string;
}
