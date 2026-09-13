import { describe, expect, it } from "vitest";
import {
  imageLibraryReducer,
  initialImageLibraryState,
} from "../src/features/library/imageLibraryState";
import type { ImageList, ImageRecord } from "../src/types";

function image(key: string): ImageRecord {
  return {
    profileId: "default",
    key,
    url: `https://example.com/${key}`,
    size: 100,
    etag: key,
    contentType: "image/png",
    originalName: `${key}.png`,
    filename: `${key}.png`,
    tags: [],
    uploadedAt: "2026-09-13T00:00:00.000Z",
    width: 10,
    height: 10,
    folder: null,
  };
}

function page(images: ImageRecord[]): ImageList {
  return {
    data: images,
    summary: { total: images.length, totalBytes: 100 * images.length, folders: [] },
    pagination: {
      cursor: null,
      truncated: false,
      limit: 50,
      offset: 0,
      total: images.length,
      totalBytes: 100 * images.length,
    },
  };
}

describe("Image Library session state", () => {
  it("resets query-dependent state atomically", () => {
    const loaded = imageLibraryReducer(initialImageLibraryState, {
      type: "loadSucceeded",
      payload: page([image("one")]),
    });
    const selecting = imageLibraryReducer(loaded, { type: "selectionStarted" });
    const selected = imageLibraryReducer(selecting, {
      type: "selectionToggled",
      key: "one",
    });
    const withDialog = imageLibraryReducer(selected, {
      type: "batchDialogOpened",
      dialog: "tags",
    });

    const changed = imageLibraryReducer(withDialog, {
      type: "searchChanged",
      search: "travel",
    });

    expect(changed).toMatchObject({
      search: "travel",
      cursor: null,
      images: [],
      loading: true,
      selectionMode: false,
      batchDialog: null,
      batchDeleteOpen: false,
    });
    expect(changed.selectedKeys).toEqual(new Set());
  });

  it("keeps only failed images selected after a batch retry", () => {
    const one = image("one");
    const two = image("two");
    let state = imageLibraryReducer(initialImageLibraryState, {
      type: "loadSucceeded",
      payload: page([one, two]),
    });
    state = imageLibraryReducer(state, { type: "selectionStarted" });
    state = imageLibraryReducer(state, {
      type: "selectionAllChanged",
      keys: [one.key, two.key],
    });
    state = imageLibraryReducer(state, {
      type: "batchDialogOpened",
      dialog: "tags",
    });

    const changed = imageLibraryReducer(state, {
      type: "batchUpdateFinished",
      updated: new Map([[one.key, { ...one, tags: ["travel"] }]]),
      failedKeys: new Set([two.key]),
      error: "1 updated; 1 failed",
    });

    expect(changed.images[0]?.tags).toEqual(["travel"]);
    expect(changed.selectedKeys).toEqual(new Set([two.key]));
    expect(changed.selectionMode).toBe(true);
    expect(changed.batchDialog).toBe("tags");
    expect(changed.batchUpdateError).toBe("1 updated; 1 failed");
  });
});
