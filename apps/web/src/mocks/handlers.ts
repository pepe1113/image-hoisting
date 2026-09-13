import { http, HttpResponse } from "msw";
import { DEFAULT_WORKSPACE_LIMITS, type ImageList, type ImageRecord } from "@image-hoisting/contracts";

export function imageList(data: ImageRecord[]): ImageList {
  const totalBytes = data.reduce((sum, image) => sum + image.size, 0);
  return {
    data,
    summary: { total: data.length, totalBytes, folders: [...new Set(data.flatMap((image) => image.folder ? [image.folder] : []))] },
    pagination: { cursor: null, truncated: false, limit: 50, offset: 0, total: data.length, totalBytes },
  };
}

export const handlers = [
  http.get("/api/auth/verify", () => HttpResponse.json({ data: { authenticated: true } })),
  http.get("/api/profiles", () => HttpResponse.json({
    data: [{ id: "default", label: "Default", isDefault: true }],
    limits: DEFAULT_WORKSPACE_LIMITS,
  })),
  http.get("/api/images", () => HttpResponse.json(imageList([]))),
];
