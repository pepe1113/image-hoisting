import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { DEFAULT_WORKSPACE_LIMITS } from "@image-hoisting/contracts";
import { server } from "../src/mocks/node";
import { reloadPage } from "../src/navigation";
import { HISTORY_IMAGES, renderApp, submitOriginalGif } from "./fixtures";

vi.mock("../src/navigation", () => ({ reloadPage: vi.fn() }));

const accessLogin = () =>
  new HttpResponse(null, {
    status: 302,
    headers: { Location: "https://team.cloudflareaccess.com/cdn-cgi/access/login" },
  });

const profilesOnce = http.get(
  "/api/profiles",
  () => HttpResponse.json({
    data: [{ id: "default", label: "Default", isDefault: true }],
    limits: DEFAULT_WORKSPACE_LIMITS,
  }),
  { once: true },
);

beforeEach(() => {
  vi.mocked(reloadPage).mockClear();
});

it("opens the workspace without asking for a key", async () => {
  renderApp();
  expect(await screen.findByRole("button", { name: "Active profile: Default" })).toBeTruthy();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
});

it("reloads the page so Access can sign in again when the session expires", async () => {
  server.use(http.get("/api/profiles", accessLogin));
  renderApp();
  expect(await screen.findByText("Your login expired. Reloading to sign in again…")).toBeTruthy();
  expect(reloadPage).toHaveBeenCalledTimes(1);
});

it("waits for an in-progress upload instead of reloading", async () => {
  let finishUpload = () => {};
  const uploadHeld = new Promise<void>((resolve) => {
    finishUpload = resolve;
  });
  server.use(
    http.post("/api/images", async () => {
      await uploadHeld;
      return HttpResponse.json({ data: { ...HISTORY_IMAGES[0], filename: "animated.gif" } }, { status: 201 });
    }),
    http.get("/api/images", accessLogin),
  );
  await submitOriginalGif();
  fireEvent.click(screen.getByRole("button", { name: "Gallery" }));

  expect(await screen.findByText("Your login expired. Reload the page after the upload finishes.")).toBeTruthy();
  expect(reloadPage).not.toHaveBeenCalled();

  finishUpload();
  fireEvent.click(screen.getByRole("button", { name: "Upload" }));
  expect(await screen.findByRole("heading", { name: "Your image is ready." })).toBeTruthy();
  expect(reloadPage).not.toHaveBeenCalled();
});

it("explains an expired login when Access blocks the upload itself", async () => {
  server.use(
    http.post("/api/images", () => HttpResponse.error()),
    profilesOnce,
    http.get("/api/profiles", accessLogin),
  );
  await submitOriginalGif();
  expect(await screen.findByText(
    "Your login expired before the upload finished. Reload the page to sign in, then upload again.",
  )).toBeTruthy();
  expect(reloadPage).not.toHaveBeenCalled();
});

it("reports a plain network error when the session is still valid", async () => {
  server.use(http.post("/api/images", () => HttpResponse.error()));
  await submitOriginalGif();
  expect(await screen.findByText("Network error. Please try again.")).toBeTruthy();
  expect(reloadPage).not.toHaveBeenCalled();
});

it("shows the Gateway rejection without reloading in a loop", async () => {
  server.use(http.get("/api/profiles", () => HttpResponse.json(
    { error: { code: "UNAUTHORIZED", message: "Cloudflare Access rejected this request: email not allowed" } },
    { status: 401 },
  )));
  renderApp();
  expect(await screen.findByText("Cloudflare Access rejected this request: email not allowed")).toBeTruthy();
  await waitFor(() => expect(reloadPage).not.toHaveBeenCalled());
});
