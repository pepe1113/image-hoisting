import type { ImageList, ImageRecord } from "../../types";

export type BatchDialog = "tags" | "folder";

interface EditorState {
  target: ImageRecord;
  filename: string;
  tags: string[];
}

export interface ImageLibraryState {
  search: string;
  folder: string | null;
  cursor: string | null;
  refreshVersion: number;
  images: ImageRecord[];
  summary: ImageList["summary"] | null;
  pagination: ImageList["pagination"] | null;
  loading: boolean;
  editor: EditorState | null;
  deleteTarget: ImageRecord | null;
  selectionMode: boolean;
  selectedKeys: Set<string>;
  batchDeleteOpen: boolean;
  batchDeleting: boolean;
  batchDialog: BatchDialog | null;
  batchTags: string[];
  batchFolder: string;
  batchUpdating: boolean;
  batchUpdateError: string;
}

export const initialImageLibraryState: ImageLibraryState = {
  search: "",
  folder: null,
  cursor: null,
  refreshVersion: 0,
  images: [],
  summary: null,
  pagination: null,
  loading: false,
  editor: null,
  deleteTarget: null,
  selectionMode: false,
  selectedKeys: new Set(),
  batchDeleteOpen: false,
  batchDeleting: false,
  batchDialog: null,
  batchTags: [],
  batchFolder: "",
  batchUpdating: false,
  batchUpdateError: "",
};

type Action =
  | { type: "loadStarted" }
  | { type: "loadSucceeded"; payload: ImageList }
  | { type: "loadFinished" }
  | { type: "refresh" }
  | { type: "loadMore"; cursor: string }
  | { type: "searchChanged"; search: string }
  | { type: "folderChanged"; folder: string | null }
  | { type: "editorOpened"; image: ImageRecord }
  | { type: "editorChanged"; filename?: string; tags?: string[] }
  | { type: "editorClosed" }
  | { type: "imageUpdated"; image: ImageRecord }
  | { type: "deleteTargetChanged"; image: ImageRecord | null }
  | { type: "imageDeleted"; key: string }
  | { type: "selectionStarted" }
  | { type: "selectionCancelled" }
  | { type: "selectionToggled"; key: string }
  | { type: "selectionAllChanged"; keys: string[] }
  | { type: "batchDeleteOpened"; open: boolean }
  | { type: "batchDeleteStarted" }
  | { type: "batchDeleteFinished"; deletedKeys: Set<string>; failedKeys: Set<string> }
  | { type: "batchDialogOpened"; dialog: BatchDialog }
  | { type: "batchDialogClosed" }
  | { type: "batchChanged"; tags?: string[]; folder?: string }
  | { type: "batchUpdateStarted" }
  | {
      type: "batchUpdateFinished";
      updated: Map<string, ImageRecord>;
      failedKeys: Set<string>;
      error: string;
    };

function withoutSelection(): Partial<ImageLibraryState> {
  return {
    selectionMode: false,
    selectedKeys: new Set(),
    batchDeleteOpen: false,
    batchDialog: null,
  };
}

function refresh(state: ImageLibraryState): Partial<ImageLibraryState> {
  return { cursor: null, refreshVersion: state.refreshVersion + 1 };
}

export function imageLibraryReducer(
  state: ImageLibraryState,
  action: Action,
): ImageLibraryState {
  switch (action.type) {
    case "loadStarted":
      return { ...state, loading: true };
    case "loadSucceeded":
      return {
        ...state,
        images:
          action.payload.pagination.offset === 0
            ? action.payload.data
            : [...state.images, ...action.payload.data],
        summary: action.payload.summary ?? null,
        pagination: action.payload.pagination,
      };
    case "loadFinished":
      return { ...state, loading: false };
    case "refresh":
      return { ...state, ...refresh(state) };
    case "loadMore":
      return { ...state, cursor: action.cursor };
    case "searchChanged":
      return {
        ...state,
        search: action.search,
        cursor: null,
        images: [],
        loading: true,
        ...withoutSelection(),
      };
    case "folderChanged":
      return {
        ...state,
        folder: action.folder,
        cursor: null,
        images: [],
        loading: true,
        ...withoutSelection(),
      };
    case "editorOpened":
      return {
        ...state,
        editor: {
          target: action.image,
          filename: action.image.filename,
          tags: action.image.tags,
        },
      };
    case "editorChanged":
      return state.editor
        ? {
            ...state,
            editor: {
              ...state.editor,
              ...(action.filename !== undefined
                ? { filename: action.filename }
                : {}),
              ...(action.tags ? { tags: action.tags } : {}),
            },
          }
        : state;
    case "editorClosed":
      return { ...state, editor: null };
    case "imageUpdated":
      return {
        ...state,
        editor: null,
        images: state.images.map((image) =>
          image.key === action.image.key ? action.image : image,
        ),
        ...refresh(state),
      };
    case "deleteTargetChanged":
      return { ...state, deleteTarget: action.image };
    case "imageDeleted": {
      const selectedKeys = new Set(state.selectedKeys);
      selectedKeys.delete(action.key);
      return {
        ...state,
        images: state.images.filter((image) => image.key !== action.key),
        selectedKeys,
        deleteTarget: null,
        ...refresh(state),
      };
    }
    case "selectionStarted":
      return { ...state, selectionMode: true, selectedKeys: new Set() };
    case "selectionCancelled":
      return { ...state, ...withoutSelection() };
    case "selectionToggled": {
      const selectedKeys = new Set(state.selectedKeys);
      if (selectedKeys.has(action.key)) selectedKeys.delete(action.key);
      else selectedKeys.add(action.key);
      return { ...state, selectedKeys };
    }
    case "selectionAllChanged":
      return { ...state, selectedKeys: new Set(action.keys) };
    case "batchDeleteOpened":
      return { ...state, batchDeleteOpen: action.open };
    case "batchDeleteStarted":
      return { ...state, batchDeleting: true };
    case "batchDeleteFinished":
      return {
        ...state,
        images: state.images.filter((image) => !action.deletedKeys.has(image.key)),
        selectedKeys: action.failedKeys,
        selectionMode: action.failedKeys.size > 0,
        batchDeleting: false,
        batchDeleteOpen: false,
        ...refresh(state),
      };
    case "batchDialogOpened":
      return {
        ...state,
        batchDialog: action.dialog,
        batchTags: [],
        batchFolder: "",
        batchUpdateError: "",
      };
    case "batchDialogClosed":
      return { ...state, batchDialog: null };
    case "batchChanged":
      return {
        ...state,
        ...(action.tags ? { batchTags: action.tags } : {}),
        ...(action.folder !== undefined ? { batchFolder: action.folder } : {}),
      };
    case "batchUpdateStarted":
      return { ...state, batchUpdating: true, batchUpdateError: "" };
    case "batchUpdateFinished":
      return {
        ...state,
        images: state.images.map((image) => action.updated.get(image.key) ?? image),
        selectedKeys: action.failedKeys,
        selectionMode: action.failedKeys.size > 0,
        batchDialog: action.failedKeys.size > 0 ? state.batchDialog : null,
        batchUpdating: false,
        batchUpdateError: action.error,
        ...refresh(state),
      };
  }
}
