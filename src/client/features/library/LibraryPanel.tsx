import { useEffect, useRef, useState } from "react";
import {
  Code,
  FolderInput,
  Link,
  Pencil,
  Search,
  Tags,
  Trash2,
} from "lucide-react";
import {
  CheckIcon,
  CopyIcon,
  GridViewIcon,
  ListViewIcon,
} from "../../components/icons";
import { Modal } from "../../components/Modal";
import {
  formatBytes,
  formatDate,
  imageName,
  markdownForImage,
} from "../../core";
import type { GalleryView } from "../../types";
import type { ImageLibraryController } from "./useImageLibrary";

interface LibraryPanelProps {
  library: ImageLibraryController;
  profileLabel: string;
  view: GalleryView;
  onViewChange: (view: GalleryView) => void;
  onCopy: (value: string, message: string) => void;
}

export function LibraryPanel({
  library,
  profileLabel,
  view,
  onViewChange,
  onCopy,
}: LibraryPanelProps) {
  const [preview, setPreview] = useState<
    ImageLibraryController["images"][number] | null
  >(null);
  const {
    search,
    folder,
    folders,
    images,
    summary,
    total,
    hasMore,
    loading,
    selectionMode,
    selectedKeys,
    selectedImages,
    allImagesSelected,
    setDeleteTarget,
    setBatchDeleteOpen,
    setSearch,
    setFolder,
    searchByTag,
    openEditor,
    loadMore,
    toggleImageSelection,
    beginSelection,
    cancelSelection,
    toggleSelectAll,
    copySelectedMarkdown,
    openBatchDialog,
  } = library;
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const selectAllCheckbox = (
    <input
      className="library-select-all"
      type="checkbox"
      aria-label="Select all"
      checked={allImagesSelected}
      onChange={toggleSelectAll}
    />
  );

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) loadMore();
      },
      { rootMargin: "300px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  return (
    <section
      className="tab-panel"
      aria-label="Image history"
      aria-busy={loading}
    >
      <div className="library-heading workspace-heading">
        <div>
          <mark className="eyebrow">PERSONAL IMAGE TOOL</mark>
          <h1 id="page-title">Image history.</h1>
          <p>
            Images stored in{" "}
            <mark className="active-profile-name">{profileLabel}</mark>. Copy,
            edit, and manage your images.
          </p>
        </div>
        <dl className="library-stats" aria-label="Profile image statistics">
          <div>
            <dt>Total files</dt>
            <dd>{summary?.total.toLocaleString("en-US") ?? "—"}</dd>
          </div>
          <div>
            <dt>Bucket size</dt>
            <dd>{summary ? formatBytes(summary.totalBytes) : "—"}</dd>
          </div>
        </dl>
      </div>
      <div className="library-toolbar">
        <div className="library-filters">
          <label className="search-field">
            <Search className="button-icon" aria-hidden="true" />
            <span className="visually-hidden">Search tags</span>
            <input
              type="search"
              value={search}
              placeholder="Search tags (comma-separated)"
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label className="folder-filter">
            <FolderInput className="button-icon" aria-hidden="true" />
            <span className="visually-hidden">Filter by folder</span>
            <select
              value={folder === null ? "all" : `folder:${folder}`}
              onChange={(event) =>
                setFolder(
                  event.target.value === "all"
                    ? null
                    : event.target.value.slice(7),
                )
              }
            >
              <option value="all">All folders</option>
              <option value="folder:">Unfiled</option>
              {folders.map((name) => (
                <option value={`folder:${name}`} key={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="library-controls">
          <div
            className="view-switcher"
            aria-label="Image view"
            data-view={view}
          >
            <button
              className={`view-button${view === "grid" ? " is-active" : ""}`}
              type="button"
              aria-label="Grid view"
              aria-pressed={view === "grid"}
              onClick={() => onViewChange("grid")}
            >
              <GridViewIcon />
            </button>
            <button
              className={`view-button${view === "list" ? " is-active" : ""}`}
              type="button"
              aria-label="List view"
              aria-pressed={view === "list"}
              onClick={() => onViewChange("list")}
            >
              <ListViewIcon />
            </button>
          </div>
          {images.length > 0 ? (
            <button
              className="button button-secondary selection-mode-button"
              type="button"
              aria-pressed={selectionMode}
              onClick={selectionMode ? cancelSelection : beginSelection}
            >
              {selectionMode ? "Cancel" : "Select"}
            </button>
          ) : null}
        </div>
      </div>
      {loading && images.length === 0 && (
        <div className="gallery skeleton-grid">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="skeleton" key={index} />
          ))}
        </div>
      )}
      {/* Empty state */}
      {!loading && images.length === 0 && (
        <div className="empty-state">
          <h3>
            {search || folder !== null
              ? "No matching images"
              : "Your history is empty"}
          </h3>
          <p>
            {search || folder !== null
              ? "Try another tag or folder."
              : "Choose Upload in the navigation to add your first image."}
          </p>
        </div>
      )}

      {/* Batch toolbar */}
      {selectionMode && (
        <div className="batch-toolbar" aria-label="Batch actions">
          <div className="selection-summary">
            {view === "grid" ? selectAllCheckbox : null}
            <span aria-live="polite">{selectedImages.length} selected</span>
          </div>
          <div className="batch-actions">
            {selectedImages.length > 0 ? (
              <>
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={loading}
                  onClick={() => openBatchDialog("tags")}
                >
                  <Tags className="button-icon" aria-hidden="true" />
                  Add Tags
                </button>
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={loading}
                  onClick={() => openBatchDialog("folder")}
                >
                  <FolderInput className="button-icon" aria-hidden="true" />
                  Move Folder
                </button>
                <button
                  className="button button-primary"
                  type="button"
                  aria-label="Copy selected Markdown"
                  onClick={copySelectedMarkdown}
                >
                  <CopyIcon />
                  Copy Markdown
                </button>
                <button
                  className="button button-danger"
                  type="button"
                  aria-label="Delete selected"
                  onClick={() => setBatchDeleteOpen(true)}
                >
                  <Trash2 className="button-icon" aria-hidden="true" />
                  Delete selected
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}

      {images.length > 0 && (
        <div
          className="gallery"
          data-view={view}
          data-selecting={selectionMode || undefined}
        >
          {view === "list" && images.length > 0 ? (
            <div className="library-columns">
              {selectionMode ? selectAllCheckbox : null}
              <span className="library-columns-file">File &amp; specs</span>
              <span>Tags</span>
              <span>Links &amp; copy</span>
              <span>Actions</span>
            </div>
          ) : null}
          {images.map((image) => (
            <article
              className="image-row"
              data-selected={selectedKeys.has(image.key) || undefined}
              key={`${image.profileId}:${image.key}`}
            >
              {selectionMode ? (
                <button
                  className="selection-toggle"
                  type="button"
                  aria-label={`${selectedKeys.has(image.key) ? "Deselect" : "Select"} ${image.filename}`}
                  aria-pressed={selectedKeys.has(image.key)}
                  onClick={() => toggleImageSelection(image.key)}
                >
                  {selectedKeys.has(image.key) ? <CheckIcon /> : null}
                </button>
              ) : null}
              <button
                className="image-frame"
                type="button"
                aria-label={`View ${image.filename} full size`}
                onClick={() => setPreview(image)}
              >
                <img src={image.url} alt={image.filename} loading="lazy" />
              </button>
              <div className="image-info">
                <div className="image-details">
                  <div className="image-title">
                    <strong className="image-name" title={imageName(image)}>
                      {imageName(image)}
                    </strong>
                    {image.contentType?.startsWith("image/") ? (
                      <span className="image-format">
                        {image.contentType.slice(6)}
                      </span>
                    ) : null}
                  </div>
                  <p className="image-meta">
                    <span>{formatDate(image.uploadedAt)}</span>
                    <span>{formatBytes(image.size)}</span>
                    <span>
                      {image.width &&
                        image.height &&
                        `${image.width}×${image.height}`}
                    </span>
                  </p>
                  {image.folder ? (
                    <span className="image-folder">{image.folder}</span>
                  ) : null}
                </div>
                <div className="image-tags">
                  {image.tags.length ? (
                    image.tags.map((tag) => (
                      <button
                        type="button"
                        key={tag}
                        onClick={() => searchByTag(tag)}
                      >
                        {tag}
                      </button>
                    ))
                  ) : (
                    <span className="no-tags">--</span>
                  )}
                </div>
                <div className="image-links">
                  <span className="image-url" title={image.url}>
                    {image.url}
                  </span>
                  <button
                    className="button button-secondary"
                    type="button"
                    aria-label={`Copy URL for ${image.filename}`}
                    title="Copy URL"
                    onClick={() => onCopy(image.url, "Image URL copied")}
                  >
                    <Link className="button-icon" aria-hidden="true" />
                    URL
                  </button>
                  {view === "list" ? (
                    <button
                      className="button button-secondary"
                      type="button"
                      aria-label={`Copy Markdown for ${image.filename}`}
                      title="Copy Markdown"
                      onClick={() =>
                        onCopy(markdownForImage(image), "Markdown copied")
                      }
                    >
                      <Code className="button-icon" aria-hidden="true" />
                      MD
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="image-actions">
                {view === "grid" ? (
                  <button
                    className="button button-primary copy-action"
                    type="button"
                    aria-label={`Copy Markdown for ${image.filename}`}
                    onClick={() =>
                      onCopy(markdownForImage(image), "Markdown copied")
                    }
                  >
                    <CopyIcon />
                    <span className="button-label">Copy Markdown</span>
                  </button>
                ) : null}
                <button
                  className="button button-secondary icon-action"
                  type="button"
                  aria-label={`Edit ${image.filename}`}
                  title="Edit image"
                  onClick={() => openEditor(image)}
                >
                  <Pencil className="button-icon" aria-hidden="true" />
                </button>
                <button
                  className="button button-secondary icon-action"
                  type="button"
                  aria-label={`Delete ${image.filename}`}
                  title="Delete image"
                  onClick={() => setDeleteTarget(image)}
                >
                  <Trash2 className="button-icon" aria-hidden="true" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* total image count */}
      {total > 0 && (
        <div ref={loadMoreRef} className="library-footer" aria-live="polite">
          {loading
            ? "Loading more images…"
            : hasMore
              ? `Showing ${images.length} of ${total} images`
              : `Showing all ${images.length} images`}
        </div>
      )}

      {/* image preview */}
      {preview && (
        <Modal
          title={imageName(preview)}
          variant="lightbox"
          onClose={() => setPreview(null)}
        >
          <img src={preview.url} alt={imageName(preview)} />
        </Modal>
      )}
    </section>
  );
}
