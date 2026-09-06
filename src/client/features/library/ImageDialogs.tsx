import { Modal } from "../../components/Modal";
import { TagEditor } from "../../components/TagEditor";
import type { ImageLibraryController } from "./useImageLibrary";
import type { WorkspaceLimits } from "../../../shared/limits";

interface ImageDialogsProps {
  library: ImageLibraryController;
  profileLabel: string;
  limits: WorkspaceLimits;
}

export function ImageDialogs({
  library,
  profileLabel,
  limits,
}: ImageDialogsProps) {
  const {
    editTarget,
    editFilename,
    editTags,
    deleteTarget,
    selectedImages,
    batchDeleteOpen,
    batchDeleting,
    setEditFilename,
    setEditTags,
    setDeleteTarget,
    setBatchDeleteOpen,
    closeEditor,
    saveEdit,
    confirmDelete,
    confirmBatchDelete,
  } = library;

  return (
    <>
      {library.batchDialog ? (
        <Modal title={library.batchDialog === "tags" ? "Add tags to selected images" : "Move selected images"} onClose={library.closeBatchDialog}>
          <form onSubmit={library.confirmBatchUpdate}>
            <fieldset className="batch-metadata-fields" disabled={library.batchUpdating || library.loading}>
              {library.batchDialog === "tags" ? (
                <>
                  <p>Tags will be added to {selectedImages.length} selected images. Existing tags are kept.</p>
                  <label className="dialog-field">
                    <span>Tags to add</span>
                    <TagEditor tags={library.batchTags} maxTags={limits.maxTags} maxTagLength={limits.maxTagLength} onChange={library.setBatchTags} />
                  </label>
                </>
              ) : (
                <>
                  <p>Move {selectedImages.length} selected images without changing their public URLs. Leave blank to move them to Unfiled.</p>
                  <label className="dialog-field">
                    <span>Folder</span>
                    <input
                      value={library.batchFolder}
                      list="history-folders"
                      maxLength={80}
                      placeholder="Unfiled"
                      onChange={(event) => library.setBatchFolder(event.target.value)}
                    />
                  </label>
                  <datalist id="history-folders">
                    {library.folders.map((folder) => <option value={folder} key={folder} />)}
                  </datalist>
                </>
              )}
              {library.batchUpdateError ? <p className="notice" role="alert">{library.batchUpdateError}</p> : null}
              <div className="dialog-actions">
                <button className="button button-secondary" type="button" onClick={library.closeBatchDialog}>Cancel</button>
                <button className="button button-primary" type="submit" disabled={selectedImages.length === 0 || (library.batchDialog === "tags" && library.batchTags.length === 0)}>
                  {library.batchUpdating ? "Updating…" : library.batchUpdateError ? "Retry failed images" : library.batchDialog === "tags" ? "Add Tags" : "Move images"}
                </button>
              </div>
            </fieldset>
          </form>
        </Modal>
      ) : null}
      {editTarget ? (
        <Modal title="Edit image details" onClose={closeEditor}>
          <form onSubmit={saveEdit}>
            <label className="dialog-field">
              <span>Filename</span>
              <input
                value={editFilename}
                required
                maxLength={180}
                onChange={(event) => setEditFilename(event.target.value)}
              />
            </label>
            <label className="dialog-field">
              <span>Tags</span>
              <TagEditor
                tags={editTags}
                maxTags={limits.maxTags}
                maxTagLength={limits.maxTagLength}
                onChange={setEditTags}
              />
            </label>
            <div className="dialog-actions">
              <button
                className="button button-secondary"
                type="button"
                onClick={closeEditor}
              >
                Cancel
              </button>
              <button className="button button-primary" type="submit">
                Save
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
      {deleteTarget ? (
        <Modal title="Delete this image?" onClose={() => setDeleteTarget(null)}>
          <p>
            The image will be permanently removed from {profileLabel} and its
            public URL will stop working.
          </p>
          <strong>{deleteTarget.filename}</strong>
          <div className="dialog-actions">
            <button
              className="button button-secondary"
              type="button"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </button>
            <button
              className="button button-danger"
              type="button"
              onClick={confirmDelete}
            >
              Delete image
            </button>
          </div>
        </Modal>
      ) : null}
      {batchDeleteOpen ? (
        <Modal
          title={`Delete ${selectedImages.length} images?`}
          onClose={() => {
            if (!batchDeleting) setBatchDeleteOpen(false);
          }}
        >
          <p>
            The selected images will be permanently removed from {profileLabel}.
            Their public URLs will stop working.
          </p>
          <strong>
            {selectedImages.map((image) => image.filename).join(", ")}
          </strong>
          <div className="dialog-actions">
            <button
              className="button button-secondary"
              type="button"
              disabled={batchDeleting}
              onClick={() => setBatchDeleteOpen(false)}
            >
              Cancel
            </button>
            <button
              className="button button-danger"
              type="button"
              disabled={batchDeleting}
              onClick={confirmBatchDelete}
            >
              {batchDeleting
                ? "Deleting…"
                : `Delete ${selectedImages.length} images`}
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
