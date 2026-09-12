import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { deleteImage, fetchImages, updateImage } from "../../api";
import { markdownForImage } from "../../core";
import type { ImageList, ImagePatch, ImageRecord } from "../../types";

interface UseImageLibraryOptions {
  enabled: boolean;
  token: string;
  profileId: string;
  setNotice: (message: string) => void;
  setToast: (message: string) => void;
  copyText: (value: string, message: string) => Promise<void>;
  requestErrorMessage: (error: unknown, fallback: string) => string;
}

export interface ImageLibraryController {
  search: string;
  folder: string | null;
  folders: string[];
  images: ImageRecord[];
  summary: ImageList["summary"] | null;
  total: number;
  hasMore: boolean;
  loading: boolean;
  editTarget: ImageRecord | null;
  editFilename: string;
  editTags: string[];
  deleteTarget: ImageRecord | null;
  selectionMode: boolean;
  selectedKeys: Set<string>;
  selectedImages: ImageRecord[];
  allImagesSelected: boolean;
  batchDeleteOpen: boolean;
  batchDeleting: boolean;
  batchDialog: "tags" | "folder" | null;
  batchTags: string[];
  batchUpdating: boolean;
  batchUpdateError: string;
  batchFolder: string;
  setBatchTags: (tags: string[]) => void;
  setBatchFolder: (folder: string) => void;
  setFolder: (folder: string | null) => void;
  openBatchDialog: (dialog: "tags" | "folder") => void;
  closeBatchDialog: () => void;
  confirmBatchUpdate: (event: FormEvent) => Promise<void>;
  setEditFilename: (filename: string) => void;
  setEditTags: (tags: string[]) => void;
  setDeleteTarget: (image: ImageRecord | null) => void;
  setBatchDeleteOpen: (open: boolean) => void;
  setSearch: (search: string) => void;
  searchByTag: (tag: string) => void;
  openEditor: (image: ImageRecord) => void;
  closeEditor: () => void;
  refresh: () => void;
  resetForProfile: () => void;
  loadMore: () => void;
  saveEdit: (event: FormEvent) => Promise<void>;
  confirmDelete: () => Promise<void>;
  toggleImageSelection: (key: string) => void;
  beginSelection: () => void;
  cancelSelection: () => void;
  toggleSelectAll: () => void;
  copySelectedMarkdown: () => void;
  confirmBatchDelete: () => Promise<void>;
}

export function useImageLibrary({
  enabled,
  token,
  profileId,
  setNotice,
  setToast,
  copyText,
  requestErrorMessage,
}: UseImageLibraryOptions): ImageLibraryController {
  const [search, setSearchValue] = useState("");
  const [folder, setFolderValue] = useState<string | null>(null);
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [summary, setSummary] = useState<ImageList["summary"] | null>(null);
  const [pagination, setPagination] = useState<ImageList["pagination"] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const generation = useRef(0);
  const [loading, setLoading] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [editTarget, setEditTarget] = useState<ImageRecord | null>(null);
  const [editFilename, setEditFilename] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<ImageRecord | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [batchDialog, setBatchDialog] = useState<"tags" | "folder" | null>(null);
  const [batchTags, setBatchTags] = useState<string[]>([]);
  const [batchUpdating, setBatchUpdating] = useState(false);
  const [batchUpdateError, setBatchUpdateError] = useState("");
  const [batchFolder, setBatchFolder] = useState("");
  const batchLock = useRef(false);
  const selectedImages = images.filter((image) => selectedKeys.has(image.key));
  const allImagesSelected =
    images.length > 0 && selectedImages.length === images.length;

  useEffect(() => {
    generation.current += 1;
    if (!enabled || !profileId || !token) return;
    const controller = new AbortController();
    let ignore = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      fetchImages(token, profileId, search, folder, cursor, controller.signal)
        .then((payload) => {
          if (ignore) return;
          setImages((current) =>
            payload.pagination.offset === 0
              ? payload.data
              : [...current, ...payload.data],
          );
          setSummary(payload.summary ?? null);
          setPagination(payload.pagination);
          setNotice("");
        })
        .catch((error: Error) => {
          if (ignore || error.name === "AbortError") return;
          setNotice(
            requestErrorMessage(error, "Could not load image history."),
          );
        })
        .finally(() => {
          if (!ignore) setLoading(false);
        });
    }, 200);

    return () => {
      ignore = true;
      generation.current += 1;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    enabled,
    folder,
    profileId,
    refreshVersion,
    requestErrorMessage,
    search,
    cursor,
    setNotice,
    token,
  ]);

  const refresh = useCallback(() => {
    setCursor(null);
    setRefreshVersion((version) => version + 1);
  }, []);

  function cancelSelection(): void {
    setSelectedKeys(new Set());
    setSelectionMode(false);
    setBatchDeleteOpen(false);
    setBatchDialog(null);
  }

  function setSearch(nextSearch: string): void {
    if (nextSearch === search) {
      cancelSelection();
      return;
    }
    setSearchValue(nextSearch);
    setCursor(null);
    setImages([]);
    setLoading(true);
    cancelSelection();
  }

  function resetForProfile(): void {
    generation.current += 1;
    setImages([]);
    setSummary(null);
    setPagination(null);
    setCursor(null);
    setSearchValue("");
    setFolderValue(null);
    setEditTarget(null);
    setDeleteTarget(null);
    setBatchDeleting(false);
    setBatchUpdating(false);
    batchLock.current = false;
    cancelSelection();
  }

  function openEditor(image: ImageRecord): void {
    setEditTarget(image);
    setEditFilename(image.filename);
    setEditTags(image.tags);
  }

  const loadMore = useCallback(() => {
    if (!loading && pagination?.cursor) setCursor(pagination.cursor);
  }, [loading, pagination?.cursor]);

  async function saveEdit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!editTarget) return;
    const currentGeneration = generation.current;
    try {
      const updated = await updateImage(
        token,
        profileId,
        editTarget.key,
        { filename: editFilename, tags: editTags },
      );
      if (currentGeneration !== generation.current) return;
      setImages((current) =>
        current.map((image) => (image.key === updated.key ? updated : image)),
      );
      setEditTarget(null);
      setToast("Image details updated");
      refresh();
    } catch (error) {
      if (currentGeneration !== generation.current) return;
      setNotice(requestErrorMessage(error, "Update failed."));
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!deleteTarget) return;
    const currentGeneration = generation.current;
    try {
      await deleteImage(token, profileId, deleteTarget.key);
      if (currentGeneration !== generation.current) return;
      setImages((current) =>
        current.filter((image) => image.key !== deleteTarget.key),
      );
      setSelectedKeys((current) => {
        const next = new Set(current);
        next.delete(deleteTarget.key);
        return next;
      });
      setDeleteTarget(null);
      setToast("Image deleted");
      refresh();
    } catch (error) {
      if (currentGeneration !== generation.current) return;
      setNotice(requestErrorMessage(error, "Delete failed."));
    }
  }

  function toggleImageSelection(key: string): void {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function beginSelection(): void {
    setSelectedKeys(new Set());
    setSelectionMode(true);
  }

  function toggleSelectAll(): void {
    setSelectedKeys(
      allImagesSelected
        ? new Set()
        : new Set(images.map((image) => image.key)),
    );
  }

  function copySelectedMarkdown(): void {
    if (selectedImages.length === 0) return;
    const markdown = selectedImages.map(markdownForImage).join("\n");
    void copyText(markdown, `${selectedImages.length} Markdown links copied`);
  }

  async function confirmBatchDelete(): Promise<void> {
    if (selectedImages.length === 0) return;
    const targets = selectedImages;
    const currentGeneration = generation.current;
    setBatchDeleting(true);
    const results = await Promise.allSettled(
      targets.map((image) => deleteImage(token, profileId, image.key)),
    );
    if (currentGeneration !== generation.current) return;
    const deletedKeys = new Set(
      targets.flatMap((image, index) =>
        results[index]?.status === "fulfilled" ? [image.key] : [],
      ),
    );
    const failed = results.filter((result) => result.status === "rejected");

    if (deletedKeys.size > 0) {
      setImages((current) =>
        current.filter((image) => !deletedKeys.has(image.key)),
      );
      setSelectedKeys((current) => {
        const next = new Set(current);
        for (const key of deletedKeys) next.delete(key);
        return next;
      });
    }

    if (failed.length === 0) {
      setToast(`${deletedKeys.size} images deleted`);
      setNotice("");
      setSelectionMode(false);
    } else {
      const firstError = failed[0]?.reason;
      const detail = requestErrorMessage(firstError, "Batch delete failed.");
      setNotice(
        `${deletedKeys.size} deleted; ${failed.length} failed. ${detail}`,
      );
    }
    setBatchDeleting(false);
    setBatchDeleteOpen(false);
    refresh();
  }

  function setFolder(folder: string | null): void {
    setFolderValue(folder);
    setCursor(null);
    setImages([]);
    setLoading(true);
    cancelSelection();
  }

  function openBatchDialog(dialog: "tags" | "folder"): void {
    setBatchTags([]);
    setBatchFolder("");
    setBatchUpdateError("");
    setBatchDialog(dialog);
  }

  async function confirmBatchUpdate(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (batchLock.current || loading || selectedImages.length === 0 || (batchDialog === "tags" && batchTags.length === 0)) return;
    batchLock.current = true;
    setBatchUpdating(true);
    setBatchUpdateError("");
    const currentGeneration = generation.current;
    const changes: ImagePatch = batchDialog === "folder" ? { folder: batchFolder } : { addTags: batchTags };
    const updated = new Map<string, ImageRecord>();
    const failures: { key: string; message: string }[] = [];
    for (const image of selectedImages) {
      if (currentGeneration !== generation.current) return;
      try {
        updated.set(image.key, await updateImage(token, profileId, image.key, changes));
      } catch (error) {
        failures.push({ key: image.key, message: `${image.filename}: ${requestErrorMessage(error, "Update failed.")}` });
      }
    }
    if (currentGeneration !== generation.current) return;
    setImages((current) => current.map((image) => updated.get(image.key) ?? image));
    setSelectedKeys(new Set(failures.map((failure) => failure.key)));
    setBatchUpdating(false);
    batchLock.current = false;
    if (failures.length > 0) {
      setBatchUpdateError(`${updated.size} updated; ${failures.length} failed. ${failures.map((failure) => failure.message).join(" ")}`);
    } else {
      setBatchDialog(null);
      setSelectionMode(false);
      setToast(`${updated.size} images updated`);
    }
    refresh();
  }

  return {
    search,
    folder,
    folders: summary?.folders ?? [],
    images,
    summary,
    total: pagination?.total ?? images.length,
    hasMore: Boolean(pagination?.cursor),
    loading,
    editTarget,
    editFilename,
    editTags,
    deleteTarget,
    selectionMode,
    selectedKeys,
    selectedImages,
    allImagesSelected,
    batchDeleteOpen,
    batchDeleting,
    batchDialog,
    batchTags,
    batchUpdating,
    batchUpdateError,
    batchFolder,
    setBatchTags,
    setBatchFolder,
    setFolder,
    openBatchDialog,
    closeBatchDialog: () => { if (!batchLock.current) setBatchDialog(null); },
    confirmBatchUpdate,
    setEditFilename,
    setEditTags,
    setDeleteTarget,
    setBatchDeleteOpen,
    setSearch,
    searchByTag: setSearch,
    openEditor,
    closeEditor: () => setEditTarget(null),
    refresh,
    resetForProfile,
    loadMore,
    saveEdit,
    confirmDelete,
    toggleImageSelection,
    beginSelection,
    cancelSelection,
    toggleSelectAll,
    copySelectedMarkdown,
    confirmBatchDelete,
  };
}
