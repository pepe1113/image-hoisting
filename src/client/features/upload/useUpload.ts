import { useEffect, useState, type FormEvent } from "react";
import { uploadImage } from "../../api";
import {
  extensionForFile,
  formatBytes,
  generatedFilename,
  MAX_SOURCE_BYTES,
} from "../../core";
import { prepareImage } from "../../image-processing";
import type {
  ImageRecord,
  PreparedImage,
  ProfilePreferences,
} from "../../types";

interface UseUploadOptions {
  token: string;
  profileId: string;
  preferences: ProfilePreferences;
  maxUploadBytes: number;
  setNotice: (message: string) => void;
  setToast: (message: string) => void;
  requestErrorMessage: (error: unknown, fallback: string) => string;
  onUploaded: () => void;
}

export interface UploadController {
  selectedFile: File | null;
  displayFilename: string;
  autoNamed: boolean;
  uploadTags: string[];
  prepared: PreparedImage | null;
  preparing: boolean;
  progress: number | null;
  uploadResult: ImageRecord | null;
  dragging: boolean;
  previewUrl: string;
  setDisplayFilename: (filename: string) => void;
  setAutoNamed: (autoNamed: boolean) => void;
  setUploadTags: (tags: string[]) => void;
  setPrepared: (prepared: PreparedImage | null) => void;
  setDragging: (dragging: boolean) => void;
  selectFile: (file: File) => void;
  clearSelection: () => void;
  reset: () => void;
  generateName: () => string;
  handlePrepare: (event: FormEvent) => Promise<void>;
  startUpload: (useProcessed: boolean) => Promise<void>;
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
  onUploaded,
}: UseUploadOptions): UploadController {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [displayFilename, setDisplayFilename] = useState("");
  const [autoNamed, setAutoNamed] = useState(false);
  const [uploadTags, setUploadTags] = useState<string[]>([]);
  const [prepared, setPrepared] = useState<PreparedImage | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadResult, setUploadResult] = useState<ImageRecord | null>(null);
  const [dragging, setDragging] = useState(false);
  const previewUrl = useObjectUrl(selectedFile);

  function selectFile(file: File): void {
    if (file.size > MAX_SOURCE_BYTES) {
      setNotice("The source image cannot exceed 40 MiB.");
      return;
    }
    setSelectedFile(file);
    setDisplayFilename("");
    setAutoNamed(false);
    setUploadTags([]);
    setPrepared(null);
    setProgress(null);
    setNotice("");
  }

  useEffect(() => {
    function onPaste(event: ClipboardEvent): void {
      const file = Array.from(event.clipboardData?.files ?? []).find((item) =>
        item.type.startsWith("image/"),
      );
      if (!file) return;
      event.preventDefault();
      if (file.size > MAX_SOURCE_BYTES) {
        setNotice("The source image cannot exceed 40 MiB.");
        return;
      }
      setSelectedFile(file);
      setDisplayFilename("");
      setAutoNamed(false);
      setUploadTags([]);
      setPrepared(null);
      setProgress(null);
      setNotice("");
      setToast("Image pasted and ready to upload");
    }

    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [setNotice, setToast]);

  function clearSelection(): void {
    setSelectedFile(null);
    setDisplayFilename("");
    setAutoNamed(false);
    setUploadTags([]);
    setPrepared(null);
    setProgress(null);
  }

  function reset(): void {
    clearSelection();
    setUploadResult(null);
    setDragging(false);
  }

  function generateName(): string {
    if (!selectedFile) return "";
    const extension =
      preferences.outputFormat === "original" ||
      selectedFile.type === "image/gif"
        ? extensionForFile(selectedFile)
        : "webp";
    const name = generatedFilename(extension);
    setDisplayFilename(name);
    setAutoNamed(true);
    return name;
  }

  async function handlePrepare(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!selectedFile) return;
    setPreparing(true);
    setNotice("");
    if (!displayFilename.trim()) generateName();
    try {
      setPrepared(await prepareImage(selectedFile, preferences));
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Image processing failed.",
      );
    } finally {
      setPreparing(false);
    }
  }

  async function startUpload(useProcessed: boolean): Promise<void> {
    if (!prepared) return;
    const file = useProcessed ? prepared.processed : prepared.source;
    if (file.size > maxUploadBytes) {
      setNotice(`The selected upload exceeds the ${formatBytes(maxUploadBytes)} limit.`);
      return;
    }
    let filename = displayFilename.trim();
    if (!filename) filename = generateName();
    if (autoNamed) {
      filename = filename.replace(/\.[^.]*$/u, `.${extensionForFile(file)}`);
    }
    setDisplayFilename(filename);
    setPrepared(null);
    setProgress(0);
    try {
      const image = await uploadImage(
        token,
        profileId,
        file,
        filename,
        uploadTags,
        setProgress,
      );
      setProgress(100);
      setUploadResult(image);
      setToast(`${image.filename} uploaded and ready to copy.`);
      clearSelection();
      onUploaded();
    } catch (error) {
      setNotice(requestErrorMessage(error, "Upload failed."));
      setProgress(null);
    }
  }

  return {
    selectedFile,
    displayFilename,
    autoNamed,
    uploadTags,
    prepared,
    preparing,
    progress,
    uploadResult,
    dragging,
    previewUrl,
    setDisplayFilename,
    setAutoNamed,
    setUploadTags,
    setPrepared,
    setDragging,
    selectFile,
    clearSelection,
    reset,
    generateName,
    handlePrepare,
    startUpload,
  };
}
