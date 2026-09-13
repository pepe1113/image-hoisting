import { fireEvent, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../src/mocks/node";
import { renderWithAdminKey, HISTORY_IMAGES } from "./fixtures";

async function submitOriginalGif() {
  const BrowserUrl = URL;
  vi.stubGlobal("URL", class extends BrowserUrl {
    static createObjectURL = vi.fn(() => "blob:upload-image");
    static revokeObjectURL = vi.fn();
  });
  renderWithAdminKey();
  await screen.findByRole("button", { name: "Active profile: Default" });
  fireEvent.change(document.querySelector("#file-input") as HTMLInputElement, {
    target: { files: [new File(["GIF89a"], "animated.gif", { type: "image/gif" })] },
  });
  fireEvent.change(screen.getByPlaceholderText("Leave blank to auto rename"), { target: { value: "animated.gif" } });
  fireEvent.click(screen.getByRole("button", { name: "Review upload" }));
  fireEvent.click(await screen.findByRole("button", { name: "Upload original image" }));
}

it("renders the uploaded image after a successful upload response", async () => {
  server.use(http.post("/api/images", async ({ request }) => {
    // Inspect wire bytes: Node's multipart parser rejects jsdom File instances.
    const body = await request.text();
    if (!body.includes('name="filename"\r\n\r\nanimated.gif') || !body.includes('name="file"') ||
      request.headers.get("Authorization") !== "Bearer saved-admin-key") {
      return new HttpResponse(null, { status: 400 });
    }
    return HttpResponse.json({ data: { ...HISTORY_IMAGES[0], filename: "animated.gif" } }, { status: 201 });
  }));
  await submitOriginalGif();
  expect(await screen.findByRole("heading", { name: "Your image is ready." })).toBeTruthy();
  expect(screen.getByAltText("animated.gif").getAttribute("src")).toBe(HISTORY_IMAGES[0]?.url);
});

it("shows an upload API error without rendering a successful result", async () => {
  server.use(http.post("/api/images", () =>
    HttpResponse.json({ error: { code: "UPLOAD_FAILED", message: "Upload service unavailable" } }, { status: 500 }),
  ));
  await submitOriginalGif();
  expect(await screen.findByText("Upload service unavailable")).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Your image is ready." })).toBeNull();
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
