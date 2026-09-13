import type { ImageRecord, PreparedImage } from "../../types";

export interface MeasuredImage {
  file: File;
  width: number;
  height: number;
}

export interface UploadState {
  selectedFile: File | null;
  displayFilename: string;
  autoNamed: boolean;
  tags: string[];
  prepared: PreparedImage | null;
  preparing: boolean;
  progress: number | null;
  result: ImageRecord | null;
  dragging: boolean;
  measuredImage: MeasuredImage | null;
}

export const initialUploadState: UploadState = {
  selectedFile: null,
  displayFilename: "",
  autoNamed: false,
  tags: [],
  prepared: null,
  preparing: false,
  progress: null,
  result: null,
  dragging: false,
  measuredImage: null,
};

type UploadAction =
  | { type: "fileSelected"; file: File }
  | { type: "selectionCleared" }
  | { type: "filenameChanged"; filename: string; autoNamed: boolean }
  | { type: "tagsChanged"; tags: string[] }
  | { type: "draggingChanged"; dragging: boolean }
  | { type: "dimensionsMeasured"; measuredImage: MeasuredImage }
  | { type: "preparationStarted" }
  | { type: "preparationFinished"; prepared: PreparedImage | null }
  | { type: "preparationCancelled" }
  | { type: "uploadStarted"; filename: string }
  | { type: "uploadProgressed"; progress: number }
  | { type: "uploadSucceeded"; image: ImageRecord }
  | { type: "uploadFailed" };

function emptySelection(): Pick<
  UploadState,
  | "selectedFile"
  | "displayFilename"
  | "autoNamed"
  | "tags"
  | "prepared"
  | "progress"
  | "measuredImage"
> {
  return {
    selectedFile: null,
    displayFilename: "",
    autoNamed: false,
    tags: [],
    prepared: null,
    progress: null,
    measuredImage: null,
  };
}

export function uploadReducer(
  state: UploadState,
  action: UploadAction,
): UploadState {
  switch (action.type) {
    case "fileSelected":
      return { ...state, ...emptySelection(), selectedFile: action.file };
    case "selectionCleared":
      return { ...state, ...emptySelection() };
    case "filenameChanged":
      return {
        ...state,
        displayFilename: action.filename,
        autoNamed: action.autoNamed,
      };
    case "tagsChanged":
      return { ...state, tags: action.tags };
    case "draggingChanged":
      return { ...state, dragging: action.dragging };
    case "dimensionsMeasured":
      return { ...state, measuredImage: action.measuredImage };
    case "preparationStarted":
      return { ...state, preparing: true };
    case "preparationFinished":
      return { ...state, preparing: false, prepared: action.prepared };
    case "preparationCancelled":
      return { ...state, prepared: null };
    case "uploadStarted":
      return {
        ...state,
        displayFilename: action.filename,
        prepared: null,
        progress: 0,
      };
    case "uploadProgressed":
      return { ...state, progress: action.progress };
    case "uploadSucceeded":
      return {
        ...state,
        ...emptySelection(),
        result: action.image,
        dragging: false,
      };
    case "uploadFailed":
      return { ...state, progress: null };
  }
}
