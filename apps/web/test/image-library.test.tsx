import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../src/mocks/node";
import { imageList } from "../src/mocks/handlers";
import { renderWithAdminKey, HISTORY_IMAGES } from "./fixtures";

it("renders loading until the API responds, then renders the empty state", async () => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  server.use(http.get("/api/images", async () => {
    await pending;
    return HttpResponse.json(imageList([]));
  }));
  renderWithAdminKey();
  fireEvent.click(screen.getByRole("button", { name: "Gallery" }));
  try {
    await waitFor(() => expect(screen.getByRole("region", { name: "Image gallery" }).getAttribute("aria-busy")).toBe("true"));
  } finally {
    release();
  }
  expect(await screen.findByText("Your history is empty")).toBeTruthy();
  expect(screen.getByRole("region", { name: "Image gallery" }).getAttribute("aria-busy")).toBe("false");
});

it("shows the server error when image loading fails", async () => {
  server.use(http.get("/api/images", () =>
    HttpResponse.json({ error: { code: "INTERNAL_ERROR", message: "Image service unavailable" } }, { status: 500 }),
  ));
  renderWithAdminKey();
  fireEvent.click(screen.getByRole("button", { name: "Gallery" }));
  expect(await screen.findByText("Image service unavailable")).toBeTruthy();
  expect(screen.getByRole("region", { name: "Image gallery" }).getAttribute("aria-busy")).toBe("false");
});

it("selects images and copies their Markdown in one batch", async () => {
  const writeText = vi.fn(async () => undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  server.use(http.get("/api/images", () => HttpResponse.json(imageList(HISTORY_IMAGES))));

  renderWithAdminKey();
  fireEvent.click(screen.getByRole("button", { name: "Gallery" }));
  await screen.findByRole("button", { name: "Select" });
  expect(screen.queryByRole("button", { name: "Select cover.webp" })).toBeNull();
  expect(screen.queryByRole("checkbox", { name: "Select all" })).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "List" }));
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
  server.use(http.get("/api/images", () => HttpResponse.json(imageList(HISTORY_IMAGES))));

  renderWithAdminKey();
  fireEvent.click(screen.getByRole("button", { name: "Gallery" }));
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
  server.use(http.get("/api/images", () => HttpResponse.json(imageList(HISTORY_IMAGES))));

  renderWithAdminKey();
  fireEvent.click(screen.getByRole("button", { name: "Gallery" }));
  await screen.findByRole("button", { name: "Select" });
  fireEvent.click(screen.getByRole("button", { name: "List" }));
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Image list.");
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
  fireEvent.click(screen.getByRole("button", { name: "Gallery" }));
  fireEvent.click(screen.getByRole("button", { name: "Copy Markdown for cover.webp" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledTimes(3));
});

it("loads more history while scrolling and resets filters and selection", async () => {
  let intersect = () => { };
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback) {
      intersect = () => callback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    }
    observe = vi.fn();
    disconnect = vi.fn();
  });
  const requests: { url: string; method: string }[] = [];
  server.use(http.get("/api/images", async ({ request }) => {
    requests.push(request);
    const url = new URL(request.url);
    const offset = url.searchParams.get("cursor") === "50" ? 50 : 0;
    return HttpResponse.json({
      data: [HISTORY_IMAGES[offset ? 1 : 0]],
      summary: { total: 51, totalBytes: 51000, folders: [] },
      pagination: { total: 51, totalBytes: 51000, offset, limit: 50, cursor: offset ? null : "50", truncated: !offset },
    });
  }));
  renderWithAdminKey();
  fireEvent.click(screen.getByRole("button", { name: "Gallery" }));
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
  expect(requests.some(({ url }) => url.includes("tag=blog") && !url.includes("cursor="))).toBe(true);
});

it("keeps failed batch tag updates selected and retries only those images", async () => {
  let failDetail = true;
  const records = structuredClone(HISTORY_IMAGES);
  const requests: { url: string; method: string }[] = [];
  server.use(http.all("/api/images", async ({ request }) => {
    requests.push(request);
    const url = new URL(request.url);
    if (request.method === "PATCH") {
      const record = records.find((image) => image.key === url.searchParams.get("key"))!;
      if (record.filename === "detail.webp" && failDetail) return HttpResponse.json({ error: { message: "Try again" } }, { status: 500 });
      const payload = await request.json() as { addTags: string[] };
      record.tags = [...new Set([...record.tags, ...payload.addTags])];
      return HttpResponse.json({ data: record });
    }
    return HttpResponse.json(imageList(records));
  }));
  renderWithAdminKey();
  fireEvent.click(screen.getByRole("button", { name: "Gallery" }));
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
  const patchCalls = requests.filter((request) => request.method === "PATCH");
  expect(patchCalls).toHaveLength(3);
  expect(patchCalls[2]?.url).toContain("detail.webp");
  expect(records[1]?.tags).toEqual(["featured"]);
});

it("filters logical folders and retries only failed moves without changing image URLs", async () => {
  let failDetail = true;
  const records = structuredClone(HISTORY_IMAGES);
  const requests: { url: string; method: string }[] = [];
  server.use(http.all("/api/images", async ({ request }) => {
    requests.push(request);
    const url = new URL(request.url);
    if (request.method === "PATCH") {
      const record = records.find((image) => image.key === url.searchParams.get("key"))!;
      if (record.filename === "detail.webp" && failDetail) return HttpResponse.json({ error: { message: "Try again" } }, { status: 500 });
      const payload = await request.json() as { folder: string };
      record.folder = payload.folder || null;
      return HttpResponse.json({ data: record });
    }
    const folder = url.searchParams.has("folder") ? url.searchParams.get("folder") : null;
    const data = folder === null ? records : records.filter((image) => (image.folder ?? "") === folder);
    return HttpResponse.json({ ...imageList(data), summary: imageList(records).summary });
  }));
  renderWithAdminKey();
  fireEvent.click(screen.getByRole("button", { name: "Gallery" }));
  await screen.findByText("Portfolio", { selector: ".image-folder" });
  fireEvent.change(screen.getByRole("combobox", { name: "Filter by folder" }), { target: { value: "folder:Portfolio" } });
  await waitFor(() => expect(screen.queryByRole("button", { name: "View detail.webp full size" })).toBeNull());
  await waitFor(() => expect(requests.some((request) => {
    const url = new URL(request.url);
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
  expect(requests.filter((request) => request.method === "PATCH")).toHaveLength(3);
});

it("confirms and deletes selected images in one batch", async () => {
  const records = structuredClone(HISTORY_IMAGES);
  server.use(
    http.get("/api/images", () => HttpResponse.json(imageList(records))),
    http.delete("/api/images", ({ request }) => {
      const index = records.findIndex((image) => image.key === new URL(request.url).searchParams.get("key"));
      if (index < 0) return new HttpResponse(null, { status: 404 });
      records.splice(index, 1);
      return HttpResponse.json({ data: null });
    }),
  );

  renderWithAdminKey();
  fireEvent.click(screen.getByRole("button", { name: "Gallery" }));
  await screen.findByRole("button", { name: "Select" });
  expect(screen.queryByRole("button", { name: "Select cover.webp" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Select" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Select all" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete selected" }));

  expect(screen.getByRole("dialog", { name: "Delete 2 images?" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Delete 2 images" }));

  await screen.findByText("Your history is empty");
  expect(screen.getByText("2 images deleted")).toBeTruthy();
  expect(records).toHaveLength(0);
});
