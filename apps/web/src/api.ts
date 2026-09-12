import { parseTagInput } from "./core";
import type { ImageList, ImagePatch, ImageProfile, ImageRecord } from "./types";
import {
  DEFAULT_WORKSPACE_LIMITS,
  type WorkspaceLimits,
} from "@image-hoisting/contracts";

interface ApiErrorPayload {
  error?: { code?: string; message?: string };
}

function errorMessage(payload: ApiErrorPayload | null): string {
  return payload?.error?.message?.trim() || "Something went wrong. Please try again.";
}

function profileUrl(path: string, profileId: string): string {
  const url = new URL(path, window.location.origin);
  url.searchParams.set("profile", profileId);
  return `${url.pathname}${url.search}`;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function authorizedOptions(token: string, options?: RequestInit): RequestInit {
  const headers = new Headers(options?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return { ...options, headers };
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

export async function apiFetch<T>(token: string, path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, authorizedOptions(token, options));
  const payload = (await response.json().catch(() => null)) as (T & ApiErrorPayload) | null;
  if (!response.ok) {
    throw new ApiError(
      errorMessage(payload),
      response.status,
      payload?.error?.code ?? "UNKNOWN_ERROR",
    );
  }
  return payload as T;
}

export async function verifyAdminToken(token: string): Promise<void> {
  await apiFetch(token, "/api/auth/verify");
}

function validLimit(value: unknown, fallback: number): number {
  return Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : fallback;
}

export async function fetchProfiles(
  token: string,
  signal?: AbortSignal,
): Promise<{ profiles: ImageProfile[]; limits: WorkspaceLimits }> {
  const payload = await apiFetch<{ data: ImageProfile[]; limits?: Partial<WorkspaceLimits> }>(
    token,
    "/api/profiles",
    signal ? { signal } : undefined,
  );
  return {
    profiles: payload.data,
    limits: {
      maxUploadBytes: validLimit(
        payload.limits?.maxUploadBytes,
        DEFAULT_WORKSPACE_LIMITS.maxUploadBytes,
      ),
      maxTags: validLimit(payload.limits?.maxTags, DEFAULT_WORKSPACE_LIMITS.maxTags),
      maxTagLength: validLimit(
        payload.limits?.maxTagLength,
        DEFAULT_WORKSPACE_LIMITS.maxTagLength,
      ),
    },
  };
}

export async function fetchImages(
  token: string,
  profileId: string,
  search: string,
  folder: string | null,
  cursor?: string | null,
  signal?: AbortSignal,
): Promise<ImageList> {
  const url = new URL(profileUrl("/api/images", profileId), window.location.origin);
  url.searchParams.set("limit", "50");
  if (cursor) url.searchParams.set("cursor", cursor);
  for (const tag of parseTagInput(search)) url.searchParams.append("tag", tag);
  if (folder !== null) url.searchParams.set("folder", folder);
  return apiFetch(token, `${url.pathname}${url.search}`, signal ? { signal } : undefined);
}

export function uploadImage(
  token: string,
  profileId: string,
  file: File,
  filename: string,
  tags: string[],
  onProgress: (percent: number) => void,
): Promise<ImageRecord> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.set("file", file);
    form.set("filename", filename);
    for (const tag of tags) form.append("tag", tag);

    const request = new XMLHttpRequest();
    request.open("POST", profileUrl("/api/images", profileId));
    request.setRequestHeader("Authorization", `Bearer ${token}`);
    request.responseType = "json";
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener("load", () => {
      if (request.status < 200 || request.status >= 300) {
        const payload = request.response as ApiErrorPayload | null;
        reject(new ApiError(
          errorMessage(payload),
          request.status,
          payload?.error?.code ?? "UNKNOWN_ERROR",
        ));
      } else {
        resolve((request.response as { data: ImageRecord }).data);
      }
    });
    request.addEventListener("error", () => reject(new Error("Network error. Please try again.")));
    request.send(form);
  });
}

export async function updateImage(
  token: string,
  profileId: string,
  key: string,
  changes: ImagePatch,
): Promise<ImageRecord> {
  const url = new URL(profileUrl("/api/images", profileId), window.location.origin);
  url.searchParams.set("key", key);
  const payload = await apiFetch<{ data: ImageRecord }>(token, `${url.pathname}${url.search}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  });
  return payload.data;
}

export async function deleteImage(token: string, profileId: string, key: string): Promise<void> {
  const url = new URL(profileUrl("/api/images", profileId), window.location.origin);
  url.searchParams.set("key", key);
  await apiFetch(token, `${url.pathname}${url.search}`, { method: "DELETE" });
}
