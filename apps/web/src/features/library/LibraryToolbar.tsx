import { FolderInput, Search, Tags, Trash2 } from "lucide-react";
import { CopyIcon } from "../../components/icons";
import type { GalleryView } from "../../types";
import type { ImageLibrarySession } from "./useImageLibrary";

interface LibraryToolbarProps {
  session: ImageLibrarySession;
  view: GalleryView;
}

export function LibraryToolbar({ session, view }: LibraryToolbarProps) {
  const {
    search,
    folder,
    folders,
    images,
    loading,
    selectionMode,
    selectedImages,
    allImagesSelected,
  } = session.view;
  const {
    setSearch,
    setFolder,
    beginSelection,
    cancelSelection,
    toggleSelectAll,
    copySelectedMarkdown,
    openBatchDialog,
    setBatchDeleteOpen,
  } = session.actions;

  return (
    <>
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
      {selectionMode ? (
        <div className="batch-toolbar" aria-label="Batch actions">
          <div className="selection-summary">
            {view === "grid" ? (
              <input
                className="library-select-all"
                type="checkbox"
                aria-label="Select all"
                checked={allImagesSelected}
                onChange={toggleSelectAll}
              />
            ) : null}
            <span aria-live="polite">{selectedImages.length} selected</span>
          </div>
          {selectedImages.length > 0 ? (
            <div className="batch-actions">
              <button
                className="button button-secondary"
                type="button"
                disabled={loading}
                onClick={() => openBatchDialog("tags")}
              >
                <Tags className="button-icon" aria-hidden="true" /> Add Tags
              </button>
              <button
                className="button button-secondary"
                type="button"
                disabled={loading}
                onClick={() => openBatchDialog("folder")}
              >
                <FolderInput className="button-icon" aria-hidden="true" /> Move Folder
              </button>
              <button
                className="button button-primary"
                type="button"
                aria-label="Copy selected Markdown"
                onClick={copySelectedMarkdown}
              >
                <CopyIcon /> Copy Markdown
              </button>
              <button
                className="button button-danger"
                type="button"
                aria-label="Delete selected"
                onClick={() => setBatchDeleteOpen(true)}
              >
                <Trash2 className="button-icon" aria-hidden="true" /> Delete selected
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
