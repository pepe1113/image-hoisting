import { useCallback, useEffect, useReducer, useState, type FormEvent } from "react";
import { uploadImage } from "../../api";
import {
  calculateTargetSize,
  extensionForFile,
  formatBytes,
  generatedFilename,
  MAX_SOURCE_BYTES,
  PROCESSING_PRESETS,
} from "../../core";
import { prepareImage } from "../../image-processing";
import type { ProcessingPreset, ProfilePreferences } from "../../types";
import { initialUploadState, uploadReducer } from "./uploadState";

interface UseUploadOptions {
  token: string;
  profileId: string;
  preferences: ProfilePreferences;
  maxUploadBytes: number;
  setNotice: (message: string) => void;
  setToast: (message: string) => void;
  requestErrorMessage: (error: unknown, fallback: string) => string;
  onPreferences: (preferences: ProfilePreferences) => void;
}

function useObjectUrl(file: File | null): string {
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!file) {
      setUrl("");
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  return url;
}

export function useUpload({
  token,
  profileId,
  preferences,
  maxUploadBytes,
  setNotice,
  setToast,
  requestErrorMessage,
  onPreferences,
}: UseUploadOptions) {
  const [state, dispatch] = useReducer(uploadReducer, initialUploadState);
  const previewUrl = useObjectUrl(state.selectedFile);
  const sourceDimensions =
    state.measuredImage?.file === state.selectedFile
      ? state.measuredImage
      : null;
  const isGif = state.selectedFile?.type === "image/gif";
  const effectiveOutputFormat = isGif ? "original" : preferences.outputFormat;
  const processingDisabled = isGif || effectiveOutputFormat === "original";
  const outputDimensions = sourceDimensions
    ? processingDisabled
      ? { width: sourceDimensions.width, height: sourceDimensions.height }
      : calculateTargetSize(
          sourceDimensions.width,
          sourceDimensions.height,
          preferences.maxDimension,
        )
    : null;

  const acceptFile = useCallback(
    (file: File, pasted = false): void => {
      if (file.size > MAX_SOURCE_BYTES) {
        setNotice("The source image cannot exceed 40 MiB.");
        return;
      }
      dispatch({ type: "fileSelected", file });
      setNotice("");
      if (pasted) setToast("Image pasted and ready to upload");
    },
    [setNotice, setToast],
  );

  useEffect(() => {
    function onPaste(event: ClipboardEvent): void {
      const file = Array.from(event.clipboardData?.files ?? []).find((item) =>
        item.type.startsWith("image/"),
      );
      if (!file) return;
      event.preventDefault();
      acceptFile(file, true);
    }

    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [acceptFile]);

  function generatedName(file = state.selectedFile): string {
    if (!file) return "";
    const extension =
      preferences.outputFormat === "original" || file.type === "image/gif"
        ? extensionForFile(file)
        : "webp";
    return generatedFilename(extension);
  }

  function generateName(): void {
    dispatch({
      type: "filenameChanged",
      filename: generatedName(),
      autoNamed: true,
    });
  }

  async function handlePrepare(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!state.selectedFile) return;
    dispatch({ type: "preparationStarted" });
    setNotice("");
    if (!state.displayFilename.trim()) generateName();
    try {
      const prepared = await prepareImage(state.selectedFile, preferences);
      dispatch({ type: "preparationFinished", prepared });
    } catch (error) {
      dispatch({ type: "preparationFinished", prepared: null });
      setNotice(
        error instanceof Error ? error.message : "Image processing failed.",
      );
    }
  }

  async function startUpload(useProcessed: boolean): Promise<void> {
    if (!state.prepared) return;
    const file = useProcessed
      ? state.prepared.processed
      : state.prepared.source;
    if (file.size > maxUploadBytes) {
      setNotice(
        `The selected upload exceeds the ${formatBytes(maxUploadBytes)} limit.`,
      );
      return;
    }
    let filename = state.displayFilename.trim() || generatedName(file);
    if (state.autoNamed) {
      filename = filename.replace(/\.[^.]*$/u, `.${extensionForFile(file)}`);
    }
    dispatch({ type: "uploadStarted", filename });
    try {
      const image = await uploadImage(
        token,
        profileId,
        file,
        filename,
        state.tags,
        (progress) => dispatch({ type: "uploadProgressed", progress }),
      );
      dispatch({ type: "uploadSucceeded", image });
      setToast(`${image.filename} uploaded and ready to copy.`);
    } catch (error) {
      dispatch({ type: "uploadFailed" });
      setNotice(requestErrorMessage(error, "Upload failed."));
    }
  }

  return {
    view: {
      ...state,
      previewUrl,
      sourceDimensions,
      outputDimensions,
      isGif,
      effectiveOutputFormat,
      processingDisabled,
    },
    actions: {
      selectFile: acceptFile,
      clearSelection: () => dispatch({ type: "selectionCleared" }),
      setDisplayFilename: (filename: string) =>
        dispatch({ type: "filenameChanged", filename, autoNamed: false }),
      setTags: (tags: string[]) => dispatch({ type: "tagsChanged", tags }),
      setDragging: (dragging: boolean) =>
        dispatch({ type: "draggingChanged", dragging }),
      setDimensions: (file: File, width: number, height: number) =>
        dispatch({
          type: "dimensionsMeasured",
          measuredImage: { file, width, height },
        }),
      generateName,
      handlePrepare,
      cancelPreparation: () => dispatch({ type: "preparationCancelled" }),
      startUpload,
      setPreset: (preset: ProcessingPreset) =>
        onPreferences({
          ...preferences,
          ...(preset === "custom" ? {} : PROCESSING_PRESETS[preset]),
          processingPreset: preset,
        }),
      customize: (changes: Partial<ProfilePreferences>) =>
        onPreferences({
          ...preferences,
          ...changes,
          processingPreset: "custom",
        }),
    },
  };
}

export type UploadSession = ReturnType<typeof useUpload>;
