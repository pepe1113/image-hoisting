import { render } from "@testing-library/react";
import type { ImageRecord } from "@image-hoisting/contracts";
import { App } from "../src/App";
import { ADMIN_TOKEN_KEY } from "../src/core";
export const HISTORY_IMAGES: ImageRecord[] = [
  {
    profileId: "default",
    key: "2026/08/cover.webp",
    url: "https://img.test/cover.webp",
    size: 1200,
    etag: "cover-etag",
    contentType: "image/webp",
    originalName: "cover.png",
    filename: "cover.webp",
    tags: ["blog"],
    uploadedAt: "2026-08-24T08:00:00.000Z",
    width: 640,
    height: 480,
    folder: "Portfolio",
  },
  {
    profileId: "default",
    key: "2026/08/detail.webp",
    url: "https://img.test/detail.webp",
    size: 900,
    etag: "detail-etag",
    contentType: "image/webp",
    originalName: "detail.png",
    filename: "detail.webp",
    tags: [],
    uploadedAt: "2026-08-24T07:00:00.000Z",
    width: null,
    height: null,
    folder: null,
  },
];

export function renderWithAdminKey() {
  localStorage.setItem(ADMIN_TOKEN_KEY, "saved-admin-key");
  return render(<App />);
}
