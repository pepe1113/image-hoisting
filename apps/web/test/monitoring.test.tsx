// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import * as Sentry from "@sentry/react";
import type * as SentryModule from "@sentry/react";
import { afterEach, expect, it, vi } from "vitest";
import { AppErrorBoundary, sanitizeSentryEvent } from "../src/monitoring";

vi.mock("@sentry/react", async (importOriginal) => ({
  ...(await importOriginal<typeof SentryModule>()),
  captureException: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("captures only a render crash and shows a recovery action", () => {
  const { unmount } = render(<AppErrorBoundary><p>Ready</p></AppErrorBoundary>);
  expect(screen.getByText("Ready")).toBeTruthy();
  expect(Sentry.captureException).not.toHaveBeenCalled();
  unmount();

  vi.spyOn(console, "error").mockImplementation(() => undefined);
  function Crash(): never {
    throw new Error("private-filename.webp private-tag admin-key");
  }
  render(<AppErrorBoundary><Crash /></AppErrorBoundary>);

  expect(screen.getByRole("alert")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Reload page" })).toBeTruthy();
  expect(Sentry.captureException).toHaveBeenCalledTimes(1);
});

it("removes user data while preserving release fields and stack frames", () => {
  const event = sanitizeSentryEvent({
    type: undefined,
    environment: "production",
    release: "commit-sha",
    message: "admin-key",
    request: { headers: { Authorization: "Bearer admin-key" }, data: "request-body" },
    breadcrumbs: [{ message: "private-filename.webp" }],
    extra: { tags: ["private-tag"] },
    exception: {
      values: [{
        type: "Error",
        value: "private-filename.webp",
        stacktrace: { frames: [{ filename: "src/App.tsx", vars: { token: "admin-key" } }] },
      }],
    },
  });

  expect(event.environment).toBe("production");
  expect(event.release).toBe("commit-sha");
  expect(event.exception?.values?.[0]?.stacktrace?.frames?.[0]?.filename).toBe("src/App.tsx");
  expect(JSON.stringify(event)).not.toMatch(/admin-key|private-filename|private-tag|request-body/);
});
