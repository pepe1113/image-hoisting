import { useCallback, useEffect, useState, type FormEvent } from "react";
import { deleteImage, fetchImages, updateImage } from "../../api";
import { markdownForImage } from "../../core";
import type { ImageRecord } from "../../types";

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
  images: ImageRecord[];
  cursor: string | null;
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
  loadMore: () => Promise<void>;
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
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
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
  const selectedImages = images.filter((image) => selectedKeys.has(image.key));
  const allImagesSelected =
    images.length > 0 && selectedImages.length === images.length;

  useEffect(() => {
    if (!enabled || !profileId || !token) return;
    const controller = new AbortController();
    let ignore = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      fetchImages(token, profileId, search, null, controller.signal)
        .then((payload) => {
          if (ignore) return;
          setImages(payload.data);
          setCursor(payload.pagination.cursor);
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
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    enabled,
    profileId,
    refreshVersion,
    requestErrorMessage,
    search,
    setNotice,
    token,
  ]);

  const refresh = useCallback(() => {
    setRefreshVersion((version) => version + 1);
  }, []);

  function cancelSelection(): void {
    setSelectedKeys(new Set());
    setSelectionMode(false);
    setBatchDeleteOpen(false);
  }

  function setSearch(nextSearch: string): void {
    setSearchValue(nextSearch);
    cancelSelection();
  }

  function resetForProfile(): void {
    setImages([]);
    setCursor(null);
    setSearchValue("");
    setEditTarget(null);
    setDeleteTarget(null);
    cancelSelection();
  }

  function openEditor(image: ImageRecord): void {
    setEditTarget(image);
    setEditFilename(image.filename);
    setEditTags(image.tags);
  }

  async function loadMore(): Promise<void> {
    if (!cursor) return;
    setLoading(true);
    try {
      const payload = await fetchImages(
        token,
        profileId,
        search,
        cursor,
      );
      setImages((current) => [...current, ...payload.data]);
      setCursor(payload.pagination.cursor);
    } catch (error) {
      setNotice(requestErrorMessage(error, "Could not load more images."));
    } finally {
      setLoading(false);
    }
  }

  async function saveEdit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!editTarget) return;
    try {
      const updated = await updateImage(
        token,
        profileId,
        editTarget.key,
        editFilename,
        editTags,
      );
      setImages((current) =>
        current.map((image) => (image.key === updated.key ? updated : image)),
      );
      setEditTarget(null);
      setToast("Image details updated");
    } catch (error) {
      setNotice(requestErrorMessage(error, "Update failed."));
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!deleteTarget) return;
    try {
      await deleteImage(token, profileId, deleteTarget.key);
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
    } catch (error) {
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
    setBatchDeleting(true);
    const results = await Promise.allSettled(
      targets.map((image) => deleteImage(token, profileId, image.key)),
    );
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
  }

  return {
    search,
    images,
    cursor,
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
