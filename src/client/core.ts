import type {
  AppSettings,
  ImageRecord,
  OutputFormat,
  ProcessingPreset,
  ProfilePreferences,
  SharpenLevel,
  Theme,
} from "./types";
export { MAX_TAG_LENGTH, MAX_TAGS } from "../shared/limits";

export const SETTINGS_KEY = "r2-image-settings";
export const ADMIN_TOKEN_KEY = "r2-image-admin-token";
export const MAX_SOURCE_BYTES = 40 * 1024 * 1024;

export const DEFAULT_PROFILE_PREFERENCES: ProfilePreferences = {
  processingPreset: "high",
  maxDimension: 2048,
  quality: 85,
  sharpen: "mid",
  outputFormat: "webp",
  view: "grid",
};

export const PROCESSING_PRESETS = {
  high: { maxDimension: 2048, quality: 85, sharpen: "mid", outputFormat: "webp" },
  standard: { maxDimension: 1600, quality: 80, sharpen: "low", outputFormat: "webp" },
  fast: { maxDimension: 1000, quality: 70, sharpen: "off", outputFormat: "webp" },
} as const satisfies Record<Exclude<ProcessingPreset, "custom">, Pick<ProfilePreferences, "maxDimension" | "quality" | "sharpen" | "outputFormat">>;

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "system",
  activeProfileId: "default",
  profiles: {},
};

export function readAdminToken(): string {
  return localStorage.getItem(ADMIN_TOKEN_KEY)?.trim() ?? "";
}

export function saveAdminToken(token: string): void {
  localStorage.setItem(ADMIN_TOKEN_KEY, token.trim());
}

export function clearAdminToken(): void {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KiB", "MiB", "GiB"];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

export function formatDate(value: string, locale = "en-US"): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function imageName(image: ImageRecord): string {
  return image.filename || image.originalName || image.key.split("/").at(-1) || image.key;
}

export function markdownForImage(image: Pick<ImageRecord, "url" | "filename">): string {
  const alt = image.filename.replace(/\.[^.]*$/u, "");
  return `![${alt}](${image.url})`;
}

export function parseTagInput(value: string): string[] {
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const item of value.split(/[,，]/u)) {
    const tag = item.normalize("NFKC").trim();
    const normalized = tag.toLocaleLowerCase("en");
    if (tag && !seen.has(normalized)) {
      seen.add(normalized);
      tags.push(tag);
    }
  }
  return tags;
}

export function calculateTargetSize(
  width: number,
  height: number,
  maxDimension: number,
): { width: number; height: number; resized: boolean } {
  if (![width, height, maxDimension].every(Number.isFinite) || width <= 0 || height <= 0) {
    throw new TypeError("Image dimensions must be positive numbers");
  }
  const longest = Math.max(width, height);
  if (longest <= maxDimension) return { width, height, resized: false };
  const ratio = maxDimension / longest;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
    resized: true,
  };
}

export function savedPercent(sourceBytes: number, outputBytes: number): number {
  if (sourceBytes <= 0) return 0;
  return Math.round((1 - outputBytes / sourceBytes) * 100);
}

export function scalePercent(sourceLongest: number, outputLongest: number): number {
  if (sourceLongest <= 0) return 100;
  return Math.round((outputLongest / sourceLongest) * 100);
}

export function generatedFilename(extension: string, bytes = crypto.getRandomValues(new Uint8Array(8))): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const id = Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
  return `${id}.${extension.replace(/^\./u, "") || "webp"}`;
}

export function extensionForFile(file: File): string {
  const extension = file.name.split(".").at(-1)?.toLocaleLowerCase("en");
  if (extension && /^[a-z0-9]{2,5}$/u.test(extension)) return extension;
  const byMime: Record<string, string> = {
    "image/avif": "avif",
    "image/gif": "gif",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  return byMime[file.type] ?? "webp";
}

export function profilePreferences(settings: AppSettings, profileId: string): ProfilePreferences {
  return settings.profiles[profileId] ?? DEFAULT_PROFILE_PREFERENCES;
}

function isTheme(value: unknown): value is Theme {
  return value === "system" || value === "light" || value === "dark";
}

function isPreset(value: unknown): value is ProcessingPreset {
  return value === "high" || value === "standard" || value === "fast" || value === "custom";
}

function isSharpen(value: unknown): value is SharpenLevel {
  return value === "off" || value === "low" || value === "mid" || value === "high";
}

function isOutputFormat(value: unknown): value is OutputFormat {
  return value === "original" || value === "webp";
}

function parsePreferences(value: unknown): ProfilePreferences | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (
    !isPreset(item.processingPreset) ||
    !Number.isInteger(item.maxDimension) ||
    Number(item.maxDimension) < 320 ||
    Number(item.maxDimension) > 8192 ||
    !Number.isInteger(item.quality) ||
    Number(item.quality) < 10 ||
    Number(item.quality) > 100 ||
    !isSharpen(item.sharpen) ||
    !isOutputFormat(item.outputFormat) ||
    (item.view !== "grid" && item.view !== "list")
  ) {
    return null;
  }
  return {
    processingPreset: item.processingPreset,
    maxDimension: Number(item.maxDimension),
    quality: Number(item.quality),
    sharpen: item.sharpen,
    outputFormat: item.outputFormat,
    view: item.view,
  };
}

export function parseSettings(value: unknown): AppSettings | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (
    !isTheme(item.theme) ||
    typeof item.activeProfileId !== "string" ||
    !item.profiles ||
    typeof item.profiles !== "object" ||
    Array.isArray(item.profiles)
  ) {
    return null;
  }
  const profiles: Record<string, ProfilePreferences> = {};
  for (const [id, preferences] of Object.entries(item.profiles)) {
    const parsed = parsePreferences(preferences);
    if (!parsed) return null;
    profiles[id] = parsed;
  }
  return {
    theme: item.theme,
    activeProfileId: item.activeProfileId,
    profiles,
  };
}

export function readSettings(): AppSettings {
  try {
    return parseSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null")) ?? DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}
