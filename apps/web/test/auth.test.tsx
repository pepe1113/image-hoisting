import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { App } from "../src/App";
import { ADMIN_TOKEN_KEY } from "../src/core";
import { server } from "../src/mocks/node";
import { renderWithAdminKey } from "./fixtures";

it("keeps an invalid key unsaved and displays the API error", async () => {
  server.use(http.get("/api/auth/verify", () =>
    HttpResponse.json({ error: { code: "UNAUTHORIZED", message: "Invalid admin key" } }, { status: 401 }),
  ));
  render(<App />);
  fireEvent.change(screen.getByPlaceholderText("Paste your admin key"), { target: { value: "wrong" } });
  fireEvent.click(screen.getByRole("button", { name: "Verify and save" }));
  expect(await screen.findByText("Invalid admin key")).toBeTruthy();
  expect(localStorage.getItem(ADMIN_TOKEN_KEY)).toBeNull();
  expect(screen.getByRole("dialog", { name: "Admin key" })).toBeTruthy();
});

it("clears an expired saved key when profiles return 401", async () => {
  server.use(http.get("/api/profiles", () =>
    HttpResponse.json({ error: { code: "UNAUTHORIZED", message: "Key expired" } }, { status: 401 }),
  ));
  renderWithAdminKey();
  expect(await screen.findByRole("dialog", { name: "Admin key" })).toBeTruthy();
  expect(localStorage.getItem(ADMIN_TOKEN_KEY)).toBeNull();
  expect(screen.getByText("Key expired")).toBeTruthy();
});

it("opens the admin key popup when no key is saved", async () => {
  server.use(http.get("/api/auth/verify", ({ request }) =>
    request.headers.get("Authorization") === "Bearer my-permanent-key"
      ? HttpResponse.json({ data: { authenticated: true } })
      : HttpResponse.json({ error: { message: "Invalid key" } }, { status: 401 }),
  ));
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

});

it("clears a permanently saved key from the key popup", () => {
  renderWithAdminKey();
  fireEvent.click(screen.getByRole("button", { name: "Manage admin key" }));
  fireEvent.click(screen.getByRole("button", { name: "Clear saved key" }));
  expect(localStorage.getItem(ADMIN_TOKEN_KEY)).toBeNull();
  expect(screen.getByRole("dialog", { name: "Admin key" })).toBeTruthy();
});
