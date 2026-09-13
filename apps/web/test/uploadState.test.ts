import { describe, expect, it } from "vitest";
import {
  initialUploadState,
  uploadReducer,
} from "../src/features/upload/uploadState";

describe("Upload session state", () => {
  it("resets file-dependent state in one transition", () => {
    const first = new File(["first"], "first.png", { type: "image/png" });
    const second = new File(["second"], "second.png", { type: "image/png" });
    let state = uploadReducer(initialUploadState, {
      type: "fileSelected",
      file: first,
    });
    state = uploadReducer(state, {
      type: "filenameChanged",
      filename: "custom.png",
      autoNamed: false,
    });
    state = uploadReducer(state, { type: "tagsChanged", tags: ["travel"] });
    state = uploadReducer(state, {
      type: "dimensionsMeasured",
      measuredImage: { file: first, width: 1200, height: 800 },
    });

    const changed = uploadReducer(state, {
      type: "fileSelected",
      file: second,
    });

    expect(changed).toMatchObject({
      selectedFile: second,
      displayFilename: "",
      autoNamed: false,
      tags: [],
      prepared: null,
      progress: null,
      measuredImage: null,
    });
  });
});
