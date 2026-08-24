// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/client/App";
import {
  ADMIN_TOKEN_KEY,
  DEFAULT_SETTINGS,
  calculateTargetSize,
  formatBytes,
  generatedFilename,
  markdownForImage,
  parseSettings,
  parseTagInput,
  savedPercent,
  scalePercent,
  settingsForExport,
} from "../src/client/core";

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
  },
];

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  vi.stubGlobal("matchMedia", vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })));
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

  it("validates versioned safe settings exports", () => {
    expect(parseSettings(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ ...DEFAULT_SETTINGS, version: 2 })).toBeNull();
    expect(parseSettings({
      ...DEFAULT_SETTINGS,
      profiles: {
        default: { resizePreset: "custom", maxDimension: 200, quality: 85, view: "grid" },
      },
    })).toBeNull();
    expect(settingsForExport(DEFAULT_SETTINGS)).toContain('"version": 1');
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

  it("builds safe deployment values for a new profile", () => {
    renderWithAdminKey();
    fireEvent.click(screen.getByRole("button", { name: "Add profile" }));
    expect(screen.getByRole("dialog", { name: "Add an R2 profile" })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Profile name"), { target: { value: "Archive" } });
    fireEvent.change(screen.getByLabelText("Profile ID"), { target: { value: "archive" } });
    fireEvent.change(screen.getByLabelText("R2 bucket name"), { target: { value: "archive-images" } });
    fireEvent.change(screen.getByLabelText("Worker binding"), { target: { value: "ARCHIVE_IMAGES" } });
    fireEvent.change(screen.getByLabelText("Public image URL"), { target: { value: "https://archive.example.com/" } });

    expect(screen.getByText((content) => content.includes('"binding": "ARCHIVE_IMAGES"'))).toBeTruthy();
    expect(screen.queryByText(/secret access key/iu)).toBeNull();
  });

  it("changes theme only when the user activates the control", async () => {
    renderWithAdminKey();
    const profile = await screen.findByLabelText("Active profile");
    expect(profile).toBeInstanceOf(HTMLSelectElement);
    if (!(profile instanceof HTMLSelectElement)) throw new Error("Active profile is not a select");
    expect(profile.disabled).toBe(true);
    expect(profile.title).toBe("No other profiles available");

    fireEvent.click(screen.getByRole("button", { name: "Switch to dark mode" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeTruthy();
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
    expect(screen.queryByRole("button", { name: "Select all" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    expect(screen.getByRole("button", { name: "Select cover.webp" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Select detail.webp" })).toBeTruthy();
    expect(screen.getByText("0 selected")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Select all" })).toBeTruthy();

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
    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete selected" }));

    expect(screen.getByRole("dialog", { name: "Delete 2 images?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete 2 images" }));

    await screen.findByText("Your history is empty");
    expect(screen.getByText("2 images deleted")).toBeTruthy();
    const deleteCalls = vi.mocked(fetch).mock.calls.filter(([, options]) => options?.method === "DELETE");
    expect(deleteCalls).toHaveLength(2);
  });
});
