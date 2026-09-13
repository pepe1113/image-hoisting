import { fireEvent, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { renderWithAdminKey } from "./fixtures";

it("switches between upload, gallery and list from the header navigation", async () => {
  renderWithAdminKey();
  const navigation = screen.getByRole("navigation", { name: "Workspace" });
  expect(navigation.getAttribute("data-active")).toBe("upload");
  expect(screen.getByRole("button", { name: "Upload" }).getAttribute("aria-current")).toBe("page");

  fireEvent.click(screen.getByRole("button", { name: "Gallery" }));
  expect(navigation.getAttribute("data-active")).toBe("gallery");
  expect(screen.getByRole("button", { name: "Gallery" }).getAttribute("aria-current")).toBe("page");
  expect(await screen.findByText("Your history is empty")).toBeTruthy();
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Gallery.");

  fireEvent.click(screen.getByRole("button", { name: "List" }));
  expect(navigation.getAttribute("data-active")).toBe("list");
  expect(screen.getByRole("button", { name: "List" }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Image list.");
  expect(screen.queryByLabelText("Image view")).toBeNull();
});

it("opens the mobile navigation menu", () => {
  renderWithAdminKey();
  const menu = screen.getByRole("button", { name: "Open navigation menu" });
  fireEvent.click(menu);
  expect(screen.getByRole("button", { name: "Close navigation menu" }).getAttribute("aria-expanded")).toBe("true");
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
