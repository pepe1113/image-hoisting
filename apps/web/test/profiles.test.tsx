import { fireEvent, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../src/mocks/node";
import { renderWithAdminKey } from "./fixtures";

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

it("switches profiles from a custom menu and highlights the active bucket", async () => {
  server.use(http.get("/api/profiles", () => HttpResponse.json({
    data: [
      { id: "default", label: "Blog images", isDefault: true },
      { id: "archive", label: "Archive", isDefault: false },
    ]
  })));

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
