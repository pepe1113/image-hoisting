export type { ImageList, ImagePatch, ImageProfile, ImageRecord } from "@image-hoisting/contracts";

export type Theme = "system" | "light" | "dark";
export type GalleryView = "grid" | "list";
export type ProcessingPreset = "high" | "standard" | "fast" | "custom";
export type SharpenLevel = "off" | "low" | "mid" | "high";
export type OutputFormat = "original" | "webp";
export type WorkspaceTab = "upload" | "gallery" | "list";

export interface ProfilePreferences {
  processingPreset: ProcessingPreset;
  maxDimension: number;
  quality: number;
  sharpen: SharpenLevel;
  outputFormat: OutputFormat;
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
