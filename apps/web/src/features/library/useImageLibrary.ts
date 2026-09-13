import { useCallback, useEffect, useReducer, useRef, type FormEvent } from "react";
import { deleteImage, fetchImages, updateImage } from "../../api";
import { markdownForImage } from "../../core";
import type { ImagePatch, ImageRecord } from "../../types";
import {
  imageLibraryReducer,
  initialImageLibraryState,
  type BatchDialog,
} from "./imageLibraryState";

interface UseImageLibraryOptions {
  enabled: boolean;
  token: string;
  profileId: string;
  setNotice: (message: string) => void;
  setToast: (message: string) => void;
  copyText: (value: string, message: string) => Promise<void>;
  requestErrorMessage: (error: unknown, fallback: string) => string;
}

export function useImageLibrary({
  enabled,
  token,
  profileId,
  setNotice,
  setToast,
  copyText,
  requestErrorMessage,
}: UseImageLibraryOptions) {
  const [state, dispatch] = useReducer(imageLibraryReducer, initialImageLibraryState);
  const generation = useRef(0);
  const batchLock = useRef(false);
  const selectedImages = state.images.filter((image) => state.selectedKeys.has(image.key));
  const allImagesSelected =
    state.images.length > 0 && selectedImages.length === state.images.length;

  useEffect(() => {
    generation.current += 1;
    if (!enabled || !profileId || !token) return;
    const controller = new AbortController();
    let ignore = false;
    const timer = window.setTimeout(() => {
      dispatch({ type: "loadStarted" });
      fetchImages(
        token,
        profileId,
        state.search,
        state.folder,
        state.cursor,
        controller.signal,
      )
        .then((payload) => {
          if (ignore) return;
          dispatch({ type: "loadSucceeded", payload });
          setNotice("");
        })
        .catch((error: Error) => {
          if (ignore || error.name === "AbortError") return;
          setNotice(requestErrorMessage(error, "Could not load image history."));
        })
        .finally(() => {
          if (!ignore) dispatch({ type: "loadFinished" });
        });
    }, 200);

    return () => {
      ignore = true;
      generation.current += 1;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    enabled, profileId, requestErrorMessage, setNotice, token,
    state.cursor, state.folder, state.refreshVersion, state.search,
  ]);

  const loadMore = useCallback(() => {
    if (!state.loading && state.pagination?.cursor) {
      dispatch({ type: "loadMore", cursor: state.pagination.cursor });
    }
  }, [state.loading, state.pagination?.cursor]);

  function setSearch(search: string): void {
    dispatch(
      search === state.search
        ? { type: "selectionCancelled" }
        : { type: "searchChanged", search },
    );
  }

  async function saveEdit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!state.editor) return;
    const currentGeneration = generation.current;
    try {
      const updated = await updateImage(
        token,
        profileId,
        state.editor.target.key,
        { filename: state.editor.filename, tags: state.editor.tags },
      );
      if (currentGeneration !== generation.current) return;
      dispatch({ type: "imageUpdated", image: updated });
      setToast("Image details updated");
    } catch (error) {
      if (currentGeneration !== generation.current) return;
      setNotice(requestErrorMessage(error, "Update failed."));
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!state.deleteTarget) return;
    const target = state.deleteTarget;
    const currentGeneration = generation.current;
    try {
      await deleteImage(token, profileId, target.key);
      if (currentGeneration !== generation.current) return;
      dispatch({ type: "imageDeleted", key: target.key });
      setToast("Image deleted");
    } catch (error) {
      if (currentGeneration !== generation.current) return;
      setNotice(requestErrorMessage(error, "Delete failed."));
    }
  }

  async function confirmBatchDelete(): Promise<void> {
    if (selectedImages.length === 0) return;
    const targets = selectedImages;
    const currentGeneration = generation.current;
    dispatch({ type: "batchDeleteStarted" });
    const results = await Promise.allSettled(
      targets.map((image) => deleteImage(token, profileId, image.key)),
    );
    if (currentGeneration !== generation.current) return;
    const deletedKeys = new Set(
      targets.flatMap((image, index) =>
        results[index]?.status === "fulfilled" ? [image.key] : [],
      ),
    );
    const failedKeys = new Set(
      targets.flatMap((image, index) =>
        results[index]?.status === "rejected" ? [image.key] : [],
      ),
    );
    const firstFailure = results.find((result) => result.status === "rejected");

    dispatch({ type: "batchDeleteFinished", deletedKeys, failedKeys });
    if (failedKeys.size === 0) {
      setToast(`${deletedKeys.size} images deleted`);
      setNotice("");
    } else {
      const detail = requestErrorMessage(firstFailure?.reason, "Batch delete failed.");
      setNotice(`${deletedKeys.size} deleted; ${failedKeys.size} failed. ${detail}`);
    }
  }

  async function confirmBatchUpdate(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (
      batchLock.current ||
      state.loading ||
      selectedImages.length === 0 ||
      (state.batchDialog === "tags" && state.batchTags.length === 0)
    ) return;
    batchLock.current = true;
    dispatch({ type: "batchUpdateStarted" });
    const currentGeneration = generation.current;
    const changes: ImagePatch =
      state.batchDialog === "folder"
        ? { folder: state.batchFolder }
        : { addTags: state.batchTags };
    const updated = new Map<string, ImageRecord>();
    const failures: { key: string; message: string }[] = [];
    for (const image of selectedImages) {
      if (currentGeneration !== generation.current) return;
      try {
        updated.set(
          image.key,
          await updateImage(token, profileId, image.key, changes),
        );
      } catch (error) {
        failures.push({
          key: image.key,
          message: `${image.filename}: ${requestErrorMessage(error, "Update failed.")}`,
        });
      }
    }
    if (currentGeneration !== generation.current) return;
    batchLock.current = false;
    const failureMessages = failures.map((failure) => failure.message).join(" ");
    const error = failures.length
      ? `${updated.size} updated; ${failures.length} failed. ${failureMessages}`
      : "";
    dispatch({
      type: "batchUpdateFinished",
      updated,
      failedKeys: new Set(failures.map((failure) => failure.key)),
      error,
    });
    if (failures.length === 0) setToast(`${updated.size} images updated`);
  }

  return {
    view: {
      ...state,
      folders: state.summary?.folders ?? [],
      total: state.pagination?.total ?? state.images.length,
      hasMore: Boolean(state.pagination?.cursor),
      selectedImages,
      allImagesSelected,
    },
    actions: {
      setSearch,
      setFolder: (folder: string | null) => dispatch({ type: "folderChanged", folder }),
      loadMore,
      beginSelection: () => dispatch({ type: "selectionStarted" }),
      cancelSelection: () => dispatch({ type: "selectionCancelled" }),
      toggleImageSelection: (key: string) => dispatch({ type: "selectionToggled", key }),
      toggleSelectAll: () =>
        dispatch({
          type: "selectionAllChanged",
          keys: allImagesSelected ? [] : state.images.map((image) => image.key),
        }),
      copySelectedMarkdown: () => {
        if (selectedImages.length === 0) return;
        void copyText(
          selectedImages.map(markdownForImage).join("\n"),
          `${selectedImages.length} Markdown links copied`,
        );
      },
      openEditor: (image: ImageRecord) => dispatch({ type: "editorOpened", image }),
      closeEditor: () => dispatch({ type: "editorClosed" }),
      setEditFilename: (filename: string) => dispatch({ type: "editorChanged", filename }),
      setEditTags: (tags: string[]) => dispatch({ type: "editorChanged", tags }),
      setDeleteTarget: (image: ImageRecord | null) =>
        dispatch({ type: "deleteTargetChanged", image }),
      saveEdit,
      confirmDelete,
      setBatchDeleteOpen: (open: boolean) => dispatch({ type: "batchDeleteOpened", open }),
      confirmBatchDelete,
      openBatchDialog: (dialog: BatchDialog) => dispatch({ type: "batchDialogOpened", dialog }),
      closeBatchDialog: () => {
        if (!batchLock.current) dispatch({ type: "batchDialogClosed" });
      },
      setBatchTags: (tags: string[]) => dispatch({ type: "batchChanged", tags }),
      setBatchFolder: (folder: string) => dispatch({ type: "batchChanged", folder }),
      confirmBatchUpdate,
    },
  };
}

export type ImageLibrarySession = ReturnType<typeof useImageLibrary>;
