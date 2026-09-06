// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/client/App";
import {
  ADMIN_TOKEN_KEY,
  DEFAULT_SETTINGS,
  PROCESSING_PRESETS,
  calculateTargetSize,
  formatBytes,
  generatedFilename,
  markdownForImage,
  parseSettings,
  parseTagInput,
  savedPercent,
  scalePercent,
} from "../src/client/core";
import { prepareImage } from "../src/client/image-processing";
import {
  applyUnsharpMask,
  SHARPEN_AMOUNTS,
} from "../src/client/image-processing-core";

function memoryStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    get length() { return entries.size; },
    clear: () => entries.clear(),
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => [...entries.keys()][index] ?? null,
    removeItem: (key) => entries.delete(key),
    setItem: (key, value) => entries.set(key, String(value)),
  };
}

const HISTORY_IMAGES = [
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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })));
  vi.stubGlobal("IntersectionObserver", class {
    observe = vi.fn();
    disconnect = vi.fn();
  });
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/auth/verify")) {
      return Response.json({ data: { authenticated: true } });
    }
    if (url.includes("/api/profiles")) {
      return Response.json({ data: [{ id: "default", label: "Default", isDefault: true }] });
    }
    if (url.includes("/api/images")) {
      return Response.json({ data: [], pagination: { cursor: null, truncated: false } });
    }
    return Response.json({ error: { message: "Not found" } }, { status: 404 });
  }));
});

function renderWithAdminKey() {
  localStorage.setItem(ADMIN_TOKEN_KEY, "saved-admin-key");
  return render(<App />);
}

describe("frontend helpers", () => {
  it("calculates resize and file-saving percentages", () => {
    expect(calculateTargetSize(4000, 3000, 1920)).toEqual({
      width: 1920,
      height: 1440,
      resized: true,
    });
    expect(calculateTargetSize(1200, 800, 1920)).toEqual({
      width: 1200,
      height: 800,
      resized: false,
    });
    expect(scalePercent(4000, 1920)).toBe(48);
    expect(savedPercent(1000, 370)).toBe(63);
    expect(savedPercent(1000, 1120)).toBe(-12);
  });

  it("formats sizes, tags, Markdown alt text, and random filenames", () => {
    expect(formatBytes(1536)).toBe("1.5 KiB");
    expect(parseTagInput(" Blog, 作品，blog ")).toEqual(["Blog", "作品"]);
    expect(markdownForImage({ filename: "cover-image.webp", url: "https://img.test/id" })).toBe(
      "![cover-image](https://img.test/id)",
    );
    expect(generatedFilename("webp", new Uint8Array(8))).toBe("aaaaaaaa.webp");
  });

  it("validates stored settings", () => {
    expect(parseSettings(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({
      ...DEFAULT_SETTINGS,
      profiles: {
        default: {
          processingPreset: "custom",
          maxDimension: 200,
          quality: 85,
          sharpen: "off",
          outputFormat: "webp",
          view: "grid",
        },
      },
    })).toBeNull();
    expect(parseSettings({
      theme: "dark",
      activeProfileId: "default",
      profiles: {
        default: { resizePreset: "original", maxDimension: 1920, quality: 85, view: "list" },
      },
    })).toBeNull();
  });

  it("maps presets and sharpens contrast without changing alpha", () => {
    expect(PROCESSING_PRESETS.standard).toEqual({
      maxDimension: 1600,
      quality: 80,
      sharpen: "low",
      outputFormat: "webp",
    });
    expect(SHARPEN_AMOUNTS).toEqual({ off: 0, low: 0.2, mid: 0.4, high: 0.7 });
    const pixels = new Uint8ClampedArray([
      50, 50, 50, 255, 50, 50, 50, 255, 50, 50, 50, 255,
      50, 50, 50, 255, 100, 100, 100, 128, 50, 50, 50, 255,
      50, 50, 50, 255, 50, 50, 50, 255, 50, 50, 50, 255,
    ]);
    applyUnsharpMask(pixels, 3, 3, 0.7);
    expect(pixels[16]).toBeGreaterThan(100);
    expect(pixels[19]).toBe(128);
  });

  it("falls back to the main-thread canvas when image workers are unavailable", async () => {
    const close = vi.fn();
    vi.stubGlobal("Worker", undefined);
    vi.stubGlobal("OffscreenCanvas", undefined);
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 400, height: 300, close })));
    const canvas = document.createElement("canvas");
    const context = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 })),
      putImageData: vi.fn(),
    };
    vi.spyOn(canvas, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
    vi.spyOn(canvas, "toBlob").mockImplementation((callback) => {
      callback(new Blob(["webp"], { type: "image/webp" }));
    });
    vi.spyOn(document, "createElement").mockReturnValue(canvas);

    const result = await prepareImage(
      new File(["source"], "cover.png", { type: "image/png" }),
      { ...PROCESSING_PRESETS.fast, processingPreset: "fast", view: "grid" },
    );

    expect(result.changed).toBe(true);
    expect(result.outputWidth).toBe(400);
    expect(result.outputHeight).toBe(300);
    expect(result.processed.type).toBe("image/webp");
    expect(close).toHaveBeenCalledOnce();
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
  });
});

describe("React image workspace", () => {
  it("opens the admin key popup when no key is saved", async () => {
    render(<App />);
    expect(screen.getByRole("dialog", { name: "Admin key" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Set admin key" })).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("Paste your admin key"), {
      target: { value: "my-permanent-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify and save" }));

    await waitFor(() => expect(localStorage.getItem(ADMIN_TOKEN_KEY)).toBe("my-permanent-key"));
    expect(screen.queryByRole("dialog", { name: "Admin key" })).toBeNull();
    expect(screen.getByRole("button", { name: "Manage admin key" })).toBeTruthy();

    const fetchMock = vi.mocked(fetch);
    const verifyCall = fetchMock.mock.calls.find(([input]) => String(input).includes("/api/auth/verify"));
    expect(new Headers(verifyCall?.[1]?.headers).get("Authorization")).toBe(
      "Bearer my-permanent-key",
    );
  });

  it("clears a permanently saved key from the key popup", () => {
    renderWithAdminKey();
    fireEvent.click(screen.getByRole("button", { name: "Manage admin key" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear saved key" }));
    expect(localStorage.getItem(ADMIN_TOKEN_KEY)).toBeNull();
    expect(screen.getByRole("dialog", { name: "Admin key" })).toBeTruthy();
  });

  it("switches between upload and history from the header navigation", async () => {
    renderWithAdminKey();
    const navigation = screen.getByRole("navigation", { name: "Workspace" });
    expect(navigation.getAttribute("data-active")).toBe("upload");
    expect(screen.getByRole("button", { name: "Upload" }).getAttribute("aria-current")).toBe("page");

    fireEvent.click(screen.getByRole("button", { name: "History" }));
    expect(navigation.getAttribute("data-active")).toBe("history");
    expect(screen.getByRole("button", { name: "History" }).getAttribute("aria-current")).toBe("page");
    expect(await screen.findByText("Your history is empty")).toBeTruthy();

    const viewSwitcher = screen.getByLabelText("Image view");
    expect(viewSwitcher.getAttribute("data-view")).toBe("grid");
    fireEvent.click(screen.getByRole("button", { name: "List view" }));
    expect(viewSwitcher.getAttribute("data-view")).toBe("list");
  });

  it("opens the mobile navigation menu", () => {
    renderWithAdminKey();
    const menu = screen.getByRole("button", { name: "Open navigation menu" });
    fireEvent.click(menu);
    expect(screen.getByRole("button", { name: "Close navigation menu" }).getAttribute("aria-expanded")).toBe("true");
  });

  it("links the selected upload preview to the original image", async () => {
    const BrowserUrl = URL;
    vi.stubGlobal("URL", class extends BrowserUrl {
      static createObjectURL = vi.fn(() => "blob:selected-image");
      static revokeObjectURL = vi.fn();
    });
    renderWithAdminKey();

    const file = new File(["image"], "image.png", { type: "image/png" });
    fireEvent.change(document.querySelector("#file-input") as HTMLInputElement, {
      target: { files: [file] },
    });

    const preview = await screen.findByRole("link", {
      name: "Open full-size preview of image.png",
    });
    expect(preview.getAttribute("href")).toBe("blob:selected-image");
    expect(preview.getAttribute("target")).toBe("_blank");
    expect(preview.querySelector("img")?.getAttribute("src")).toBe(
      "blob:selected-image",
    );
  });

  it("edits processing in the upload panel and calculates proportional dimensions", async () => {
    const BrowserUrl = URL;
    vi.stubGlobal("URL", class extends BrowserUrl {
      static createObjectURL = vi.fn(() => "blob:processing-image");
      static revokeObjectURL = vi.fn();
    });
    renderWithAdminKey();

    const file = new File(["image"], "cover.png", { type: "image/png" });
    fireEvent.change(document.querySelector("#file-input") as HTMLInputElement, {
      target: { files: [file] },
    });

    const preview = await screen.findByAltText("Preview of the image ready to upload");
    Object.defineProperties(preview, {
      naturalWidth: { configurable: true, value: 4000 },
      naturalHeight: { configurable: true, value: 3000 },
    });
    fireEvent.load(preview);

    expect(await screen.findByText("Processing for Default")).toBeTruthy();
    expect(screen.getByText("4000×3000 → 2048×1536px")).toBeTruthy();

    const longEdge = screen.getByRole("slider", { name: "Maximum long edge" });
    const quality = screen.getByRole("slider", { name: "WebP quality" });
    fireEvent.change(longEdge, { target: { value: "1280" } });
    fireEvent.change(quality, { target: { value: "90" } });

    expect(screen.getByText("4000×3000 → 1280×960px")).toBeTruthy();
    expect(screen.getByText("1280px")).toBeTruthy();
    expect(screen.getByText("90%")).toBeTruthy();
    expect((screen.getByLabelText("Preset") as unknown as { value: string }).value).toBe("custom");

    fireEvent.change(screen.getByLabelText("Preset"), { target: { value: "standard" } });
    expect(screen.getByText("4000×3000 → 1600×1200px")).toBeTruthy();
    expect((screen.getByLabelText("Sharpen") as unknown as { value: string }).value).toBe("low");

    expect(screen.queryByRole("button", { name: "Open settings" })).toBeNull();
  });

  it("locks processing controls and shows Original for GIF uploads", async () => {
    const BrowserUrl = URL;
    vi.stubGlobal("URL", class extends BrowserUrl {
      static createObjectURL = vi.fn(() => "blob:animated-image");
      static revokeObjectURL = vi.fn();
    });
    renderWithAdminKey();

    fireEvent.change(document.querySelector("#file-input") as HTMLInputElement, {
      target: { files: [new File(["gif"], "animated.gif", { type: "image/gif" })] },
    });

    expect(await screen.findByText("Animated GIF stays in its original format.")).toBeTruthy();
    expect(screen.getByLabelText("Preset").hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("slider", { name: "Maximum long edge" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("slider", { name: "WebP quality" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByLabelText("Sharpen").hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Original" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "WebP" }).hasAttribute("disabled")).toBe(true);
  });

  it("closes a modal with cancel and restores focus", () => {
    renderWithAdminKey();
    const trigger = screen.getByRole("button", { name: "Add profile" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Add an R2 profile" });
    fireEvent(dialog, new Event("cancel", { bubbles: false, cancelable: true }));

    expect(screen.queryByRole("dialog", { name: "Add an R2 profile" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("copies two directly pasteable deployment values for a new profile", async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    renderWithAdminKey();
    fireEvent.click(screen.getByRole("button", { name: "Add profile" }));
    expect(screen.getByRole("dialog", { name: "Add an R2 profile" })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Profile name"), { target: { value: "Archive" } });
    fireEvent.change(screen.getByLabelText("Profile ID"), { target: { value: "archive" } });
    fireEvent.change(screen.getByLabelText("R2 bucket name"), { target: { value: "archive-images" } });
    fireEvent.change(screen.getByLabelText("Worker binding"), { target: { value: "ARCHIVE_IMAGES" } });
    fireEvent.change(screen.getByLabelText("Public image URL"), { target: { value: "https://archive.example.com/" } });

    const bucketBinding = `{
  "binding": "ARCHIVE_IMAGES",
  "bucket_name": "archive-images"
},`;
    const profileEntry = `{
  "id": "archive",
  "label": "Archive",
  "binding": "ARCHIVE_IMAGES",
  "publicBaseUrl": "https://archive.example.com"
},`;

    fireEvent.click(screen.getByRole("button", { name: "Copy R2 bucket binding" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(bucketBinding));
    fireEvent.click(screen.getByRole("button", { name: "Copy profile entry" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(profileEntry));
    expect(screen.queryByText(/secret access key/iu)).toBeNull();
  });

  it("changes theme only when the user activates the control", async () => {
    renderWithAdminKey();
    const profile = await screen.findByRole("button", { name: "Active profile: Default" });
    expect(profile).toHaveProperty("disabled", true);
    expect(profile.title).toBe("No other profiles available");
    expect(screen.queryByRole("combobox")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Switch to dark mode" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeTruthy();
  });

  it("switches profiles from a custom menu and highlights the active bucket", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/profiles")) {
        return Response.json({ data: [
          { id: "default", label: "Blog images", isDefault: true },
          { id: "archive", label: "Archive", isDefault: false },
        ] });
      }
      if (url.includes("/api/images")) {
        return Response.json({ data: [], pagination: { cursor: null, truncated: false } });
      }
      return Response.json({ error: { message: "Not found" } }, { status: 404 });
    }));

    renderWithAdminKey();
    const trigger = await screen.findByRole("button", { name: "Active profile: Blog images" });
    fireEvent.click(trigger);

    expect(screen.getByRole("listbox", { name: "Profiles" })).toBeTruthy();
    expect(
      screen.getByRole("option", { name: "Blog images" }).querySelector(".profile-option-check"),
    ).toBeTruthy();
    expect(
      screen.getByRole("option", { name: "Archive" }).querySelector(".profile-option-check"),
    ).toBeNull();
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("listbox", { name: "Profiles" })).toBeNull();

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("option", { name: "Archive" }));

    expect(screen.queryByRole("listbox", { name: "Profiles" })).toBeNull();
    expect(screen.getByRole("button", { name: "Active profile: Archive" })).toBeTruthy();
    expect(screen.getByText("Archive", { selector: "mark.active-profile-name" })).toBeTruthy();
  });

  it("selects images and copies their Markdown in one batch", async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/auth/verify")) {
        return Response.json({ data: { authenticated: true } });
      }
      if (url.includes("/api/profiles")) {
        return Response.json({ data: [{ id: "default", label: "Default", isDefault: true }] });
      }
      if (url.includes("/api/images")) {
        return Response.json({ data: HISTORY_IMAGES, pagination: { cursor: null, truncated: false } });
      }
      return Response.json({ error: { message: "Not found" } }, { status: 404 });
    }));

    renderWithAdminKey();
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    await screen.findByRole("button", { name: "Select" });
    expect(screen.queryByRole("button", { name: "Select cover.webp" })).toBeNull();
    expect(screen.queryByRole("checkbox", { name: "Select all" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "List view" }));
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    expect(screen.getByRole("button", { name: "Select cover.webp" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Select detail.webp" })).toBeTruthy();
    expect(screen.getByText("0 selected")).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Select all" }).closest(".library-columns")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Select cover.webp" }));
    fireEvent.click(screen.getByRole("button", { name: "Select detail.webp" }));
    expect(screen.getByText("2 selected")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copy selected Markdown" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(
      "![cover](https://img.test/cover.webp)\n![detail](https://img.test/detail.webp)",
    ));
    expect(screen.getByText("2 Markdown links copied")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("button", { name: "Select cover.webp" })).toBeNull();
  });

  it("opens a history image in a lightbox", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/auth/verify")) {
        return Response.json({ data: { authenticated: true } });
      }
      if (url.includes("/api/profiles")) {
        return Response.json({ data: [{ id: "default", label: "Default", isDefault: true }] });
      }
      if (url.includes("/api/images")) {
        return Response.json({ data: HISTORY_IMAGES, pagination: { cursor: null, truncated: false } });
      }
      return Response.json({ error: { message: "Not found" } }, { status: 404 });
    }));

    renderWithAdminKey();
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    fireEvent.click(await screen.findByRole("button", { name: "View cover.webp full size" }));

    const dialog = screen.getByRole("dialog", { name: "cover.webp" });
    expect(dialog.getAttribute("data-variant")).toBe("lightbox");
    expect(dialog.querySelector("img")?.getAttribute("src")).toBe(
      "https://img.test/cover.webp",
    );

    fireEvent(dialog, new Event("cancel", { bubbles: false, cancelable: true }));
    expect(screen.queryByRole("dialog", { name: "cover.webp" })).toBeNull();
  });

  it("keeps list copy and edit actions connected while showing Profile statistics", async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/profiles")) {
        return Response.json({ data: [{ id: "default", label: "Default", isDefault: true }] });
      }
      if (url.includes("/api/images")) {
        return Response.json({ data: HISTORY_IMAGES, summary: { total: 2, totalBytes: 2100 }, pagination: { cursor: null, truncated: false, total: 2, totalBytes: 2100, offset: 0, limit: 50 } });
      }
      return Response.json({ data: { authenticated: true } });
    }));

    renderWithAdminKey();
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    await screen.findByRole("button", { name: "Select" });
    fireEvent.click(screen.getByRole("button", { name: "List view" }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Image history.");
    expect(screen.getByText("640×480")).toBeTruthy();
    expect(screen.getByText("Total files").nextElementSibling?.textContent).toBe("2");
    expect(screen.getByText("Bucket size").nextElementSibling?.textContent).toBe("2.1 KiB");
    expect(screen.getByText("Showing all 2 images")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Copy URL for cover.webp" }));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith("https://img.test/cover.webp"));
    fireEvent.click(screen.getByRole("button", { name: "Copy Markdown for cover.webp" }));
    await waitFor(() => expect(writeText).toHaveBeenLastCalledWith("![cover](https://img.test/cover.webp)"));
    fireEvent.click(screen.getByRole("button", { name: "Edit cover.webp" }));
    expect(screen.getByRole("dialog", { name: "Edit image details" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Grid view" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy Markdown for cover.webp" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(3));
  });

  it("loads more history while scrolling and resets filters and selection", async () => {
    let intersect = () => {};
    vi.stubGlobal("IntersectionObserver", class {
      constructor(callback: IntersectionObserverCallback) {
        intersect = () => callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
      }
      observe = vi.fn();
      disconnect = vi.fn();
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "https://app.test");
      if (url.pathname === "/api/profiles") return Response.json({ data: [{ id: "default", label: "Default", isDefault: true }] });
      const offset = url.searchParams.get("cursor") === "50" ? 50 : 0;
      return Response.json({
        data: [HISTORY_IMAGES[offset ? 1 : 0]],
        summary: { total: 51, totalBytes: 51000 },
        pagination: { total: 51, totalBytes: 51000, offset, limit: 50, cursor: offset ? null : "50", truncated: !offset },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderWithAdminKey();
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    await screen.findByRole("button", { name: "Select" });
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.click(screen.getByRole("button", { name: "Select cover.webp" }));
    act(() => intersect());
    await screen.findByRole("button", { name: "View detail.webp full size" });
    expect(screen.getByRole("button", { name: "View cover.webp full size" })).toBeTruthy();
    expect(screen.getByText("1 selected")).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search tags" }), { target: { value: "blog" } });
    await screen.findByRole("button", { name: "View cover.webp full size" });
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("tag=blog") && !String(url).includes("cursor="))).toBe(true);
  });

  it("keeps failed batch tag updates selected and retries only those images", async () => {
    let failDetail = true;
    const records = structuredClone(HISTORY_IMAGES);
    const fetchMock = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = new URL(String(input), "https://app.test");
      if (url.pathname === "/api/profiles") return Response.json({ data: [{ id: "default", label: "Default", isDefault: true }] });
      if (options?.method === "PATCH") {
        const record = records.find((image) => image.key === url.searchParams.get("key"))!;
        if (record.filename === "detail.webp" && failDetail) return Response.json({ error: { message: "Try again" } }, { status: 500 });
        const payload = JSON.parse(String(options.body)) as { addTags: string[] };
        record.tags = [...new Set([...record.tags, ...payload.addTags])];
        return Response.json({ data: record });
      }
      return Response.json({ data: records, summary: { total: 2, totalBytes: 2100 }, pagination: { total: 2, offset: 0, limit: 50, cursor: null, truncated: false } });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderWithAdminKey();
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    fireEvent.click(await screen.findByRole("button", { name: "Select" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all" }));
    fireEvent.click(screen.getByRole("button", { name: "Add Tags" }));
    const dialog = screen.getByRole("dialog", { name: "Add tags to selected images" });
    const input = within(dialog).getByRole("textbox");
    fireEvent.change(input, { target: { value: "featured" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add Tags" }));
    await within(dialog).findByText(/1 updated; 1 failed/);
    expect(records[0]?.tags).toEqual(["blog", "featured"]);
    expect(screen.getByText("1 selected")).toBeTruthy();
    failDetail = false;
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Retry failed images" }).closest("fieldset")?.disabled).toBe(false));
    fireEvent.click(within(dialog).getByRole("button", { name: "Retry failed images" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add tags to selected images" })).toBeNull());
    const patchCalls = fetchMock.mock.calls.filter(([, options]) => options?.method === "PATCH");
    expect(patchCalls).toHaveLength(3);
    expect(String(patchCalls[2]?.[0])).toContain("detail.webp");
    expect(records[1]?.tags).toEqual(["featured"]);
  });

  it("filters logical folders and retries only failed moves without changing image URLs", async () => {
    let failDetail = true;
    const records = structuredClone(HISTORY_IMAGES);
    const fetchMock = vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = new URL(String(input), "https://app.test");
      if (url.pathname === "/api/profiles") return Response.json({ data: [{ id: "default", label: "Default", isDefault: true }] });
      if (options?.method === "PATCH") {
        const record = records.find((image) => image.key === url.searchParams.get("key"))!;
        if (record.filename === "detail.webp" && failDetail) return Response.json({ error: { message: "Try again" } }, { status: 500 });
        const payload = JSON.parse(String(options.body)) as { folder: string };
        record.folder = payload.folder || null;
        return Response.json({ data: record });
      }
      const folder = url.searchParams.has("folder") ? url.searchParams.get("folder") : null;
      const data = folder === null ? records : records.filter((image) => (image.folder ?? "") === folder);
      return Response.json({ data, summary: { total: 2, totalBytes: 2100, folders: ["Portfolio"] }, pagination: { total: data.length, offset: 0, limit: 50, cursor: null, truncated: false } });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderWithAdminKey();
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    await screen.findByText("Portfolio", { selector: ".image-folder" });
    fireEvent.change(screen.getByRole("combobox", { name: "Filter by folder" }), { target: { value: "folder:Portfolio" } });
    await waitFor(() => expect(screen.queryByRole("button", { name: "View detail.webp full size" })).toBeNull());
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => {
      const url = new URL(String(input), "https://app.test");
      return url.searchParams.get("folder") === "Portfolio" && !url.searchParams.has("cursor");
    })).toBe(true));
    fireEvent.change(screen.getByRole("combobox", { name: "Filter by folder" }), { target: { value: "all" } });
    await screen.findByRole("button", { name: "View detail.webp full size" });
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all" }));
    fireEvent.click(screen.getByRole("button", { name: "Move Folder" }));
    const dialog = screen.getByRole("dialog", { name: "Move selected images" });
    fireEvent.change(within(dialog).getByRole("combobox", { name: "Folder" }), { target: { value: "Archive" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Move images" }));
    await within(dialog).findByText(/1 updated; 1 failed/);
    expect(records[0]?.url).toBe("https://img.test/cover.webp");
    expect(records[0]?.folder).toBe("Archive");
    expect(screen.getByText("1 selected")).toBeTruthy();
    failDetail = false;
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Retry failed images" }).closest("fieldset")?.disabled).toBe(false));
    fireEvent.click(within(dialog).getByRole("button", { name: "Retry failed images" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Move selected images" })).toBeNull());
    expect(records[1]?.url).toBe("https://img.test/detail.webp");
    expect(records[1]?.folder).toBe("Archive");
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === "PATCH")).toHaveLength(3);
  });

  it("confirms and deletes selected images in one batch", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/profiles")) {
        return Response.json({ data: [{ id: "default", label: "Default", isDefault: true }] });
      }
      if (url.includes("/api/images") && options?.method === "DELETE") {
        return Response.json({ data: null });
      }
      if (url.includes("/api/images")) {
        return Response.json({ data: HISTORY_IMAGES, pagination: { cursor: null, truncated: false } });
      }
      return Response.json({ error: { message: "Not found" } }, { status: 404 });
    }));

    renderWithAdminKey();
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    await screen.findByRole("button", { name: "Select" });
    expect(screen.queryByRole("button", { name: "Select cover.webp" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete selected" }));

    expect(screen.getByRole("dialog", { name: "Delete 2 images?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete 2 images" }));

    await screen.findByText("Your history is empty");
    expect(screen.getByText("2 images deleted")).toBeTruthy();
    const deleteCalls = vi.mocked(fetch).mock.calls.filter(([, options]) => options?.method === "DELETE");
    expect(deleteCalls).toHaveLength(2);
  });
});
