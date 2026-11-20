import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import type { ImageRecord } from "@image-hoisting/contracts";
import { App } from "../src/App";
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

export function renderApp() {
  return render(<App />);
}

export async function submitOriginalGif() {
  const BrowserUrl = URL;
  vi.stubGlobal("URL", class extends BrowserUrl {
    static createObjectURL = vi.fn(() => "blob:upload-image");
    static revokeObjectURL = vi.fn();
  });
  renderApp();
  await screen.findByRole("button", { name: "Active profile: Default" });
  fireEvent.change(document.querySelector("#file-input") as HTMLInputElement, {
    target: { files: [new File(["GIF89a"], "animated.gif", { type: "image/gif" })] },
  });
  fireEvent.change(screen.getByPlaceholderText("Leave blank to auto rename"), { target: { value: "animated.gif" } });
  fireEvent.click(screen.getByRole("button", { name: "Review upload" }));
  fireEvent.click(await screen.findByRole("button", { name: "Upload original image" }));
}
