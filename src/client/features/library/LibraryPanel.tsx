import {
  CheckIcon,
  CopyIcon,
  GridViewIcon,
  ListViewIcon,
} from "../../components/icons";
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
  const {
    search,
    images,
    cursor,
    loading,
    selectionMode,
    selectedKeys,
    selectedImages,
    allImagesSelected,
    setDeleteTarget,
    setBatchDeleteOpen,
    setSearch,
    searchByTag,
    openEditor,
    loadMore,
    toggleImageSelection,
    beginSelection,
    cancelSelection,
    toggleSelectAll,
    copySelectedMarkdown,
  } = library;

  return (
    <section className="library-section tab-panel" aria-label="Image history">
      <div className="library-toolbar">
        <div className="section-heading">
          <h2>Image history</h2>
          <p>Images stored in {profileLabel}.</p>
        </div>
        <div className="library-controls">
          <label className="search-field">
            <span className="visually-hidden">Search tags</span>
            <input
              type="search"
              value={search}
              placeholder="Search tags (comma-separated)"
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
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
      {loading && images.length === 0 ? (
        <div className="gallery skeleton-grid">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="skeleton" key={index} />
          ))}
        </div>
      ) : null}
      {!loading && images.length === 0 ? (
        <div className="empty-state">
          <h3>{search ? "No matching images" : "Your history is empty"}</h3>
          <p>
            {search
              ? "Try another tag."
              : "Choose Upload in the navigation to add your first image."}
          </p>
        </div>
      ) : null}
      {selectionMode ? (
        <div className="batch-toolbar" aria-label="Batch actions">
          <div className="selection-summary">
            <span aria-live="polite">{selectedImages.length} selected</span>
          </div>
          <div className="batch-actions">
            <button
              className="button button-secondary"
              type="button"
              aria-pressed={allImagesSelected}
              onClick={toggleSelectAll}
            >
              {allImagesSelected ? "Clear all" : "Select all"}
            </button>
            {selectedImages.length > 0 ? (
              <>
                <button
                  className="button button-primary"
                  type="button"
                  aria-label="Copy selected Markdown"
                  onClick={copySelectedMarkdown}
                >
                  <CopyIcon />Copy Markdown
                </button>
                <button
                  className="button button-danger"
                  type="button"
                  aria-label="Delete selected"
                  onClick={() => setBatchDeleteOpen(true)}
                >
                  Delete
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
      <div
        className="gallery"
        data-view={view}
        data-selecting={selectionMode || undefined}
      >
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
              aria-label={`Copy image URL for ${image.filename}`}
              onClick={() => onCopy(image.url, "Image URL copied")}
            >
              <img src={image.url} alt={image.filename} loading="lazy" />
            </button>
            <div className="image-info">
              <strong className="image-name" title={imageName(image)}>
                {imageName(image)}
              </strong>
              <p className="image-meta">
                {formatBytes(image.size)} / {formatDate(image.uploadedAt)}
              </p>
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
                  <span className="no-tags">No tags</span>
                )}
              </div>
              <button
                className="url-copy"
                type="button"
                title={image.url}
                onClick={() => onCopy(image.url, "Image URL copied")}
              >
                {image.url}
              </button>
            </div>
            <div className="image-actions">
              <button
                className="button button-primary copy-action"
                type="button"
                onClick={() =>
                  onCopy(markdownForImage(image), "Markdown copied")
                }
              >
                <CopyIcon />
                <span className="button-label">Copy Markdown</span>
              </button>
              <button
                className="button button-secondary icon-action"
                type="button"
                onClick={() => openEditor(image)}
              >
                <span className="button-label">Edit</span>
              </button>
              <button
                className="button button-secondary icon-action"
                type="button"
                onClick={() => setDeleteTarget(image)}
              >
                <span className="button-label">Delete</span>
              </button>
            </div>
          </article>
        ))}
      </div>
      {cursor ? (
        <div className="load-more-row">
          <button
            className="button button-secondary"
            type="button"
            disabled={loading}
            onClick={loadMore}
          >
            Load more
          </button>
        </div>
      ) : null}
    </section>
  );
}
