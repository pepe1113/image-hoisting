import { Modal } from "../../components/Modal";
import { TagEditor } from "../../components/TagEditor";
import type { ImageLibrarySession } from "./useImageLibrary";
import type { WorkspaceLimits } from "@image-hoisting/contracts";

interface ImageDialogsProps {
  session: ImageLibrarySession;
  profileLabel: string;
  limits: WorkspaceLimits;
}

export function ImageDialogs({
  session,
  profileLabel,
  limits,
}: ImageDialogsProps) {
  const {
    editor,
    deleteTarget,
    selectedImages,
    batchDeleteOpen,
    batchDeleting,
    batchDialog,
    batchUpdating,
    loading,
    batchTags,
    batchFolder,
    batchUpdateError,
    folders,
  } = session.view;
  const {
    setEditFilename,
    setEditTags,
    setDeleteTarget,
    setBatchDeleteOpen,
    closeEditor,
    saveEdit,
    confirmDelete,
    confirmBatchDelete,
    closeBatchDialog,
    confirmBatchUpdate,
    setBatchTags,
    setBatchFolder,
  } = session.actions;

  return (
    <>
      {batchDialog ? (
        <Modal
          title={
            batchDialog === "tags"
              ? "Add tags to selected images"
              : "Move selected images"
          }
          onClose={closeBatchDialog}
        >
          <form onSubmit={confirmBatchUpdate}>
            <fieldset className="batch-metadata-fields" disabled={batchUpdating || loading}>
              {batchDialog === "tags" ? (
                <>
                  <p>
                    Tags will be added to {selectedImages.length} selected
                    images. Existing tags are kept.
                  </p>
                  <label className="dialog-field">
                    <span>Tags to add</span>
                    <TagEditor
                      tags={batchTags}
                      maxTags={limits.maxTags}
                      maxTagLength={limits.maxTagLength}
                      onChange={setBatchTags}
                    />
                  </label>
                </>
              ) : (
                <>
                  <p>
                    Move {selectedImages.length} selected images without
                    changing their public URLs. Leave blank to move them to
                    Unfiled.
                  </p>
                  <label className="dialog-field">
                    <span>Folder</span>
                    <input
                      value={batchFolder}
                      list="history-folders"
                      maxLength={80}
                      placeholder="Unfiled"
                      onChange={(event) => setBatchFolder(event.target.value)}
                    />
                  </label>
                  <datalist id="history-folders">
                    {folders.map((folder) => (
                      <option value={folder} key={folder} />
                    ))}
                  </datalist>
                </>
              )}
              {batchUpdateError ? (
                <p className="notice" role="alert">
                  {batchUpdateError}
                </p>
              ) : null}
              <div className="dialog-actions">
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={closeBatchDialog}
                >
                  Cancel
                </button>
                <button
                  className="button button-primary"
                  type="submit"
                  disabled={
                    selectedImages.length === 0 ||
                    (batchDialog === "tags" && batchTags.length === 0)
                  }
                >
                  {batchUpdating
                    ? "Updating…"
                    : batchUpdateError
                      ? "Retry failed images"
                      : batchDialog === "tags"
                        ? "Add Tags"
                        : "Move images"}
                </button>
              </div>
            </fieldset>
          </form>
        </Modal>
      ) : null}
      {editor ? (
        <Modal title="Edit image details" onClose={closeEditor}>
          <form onSubmit={saveEdit}>
            <label className="dialog-field">
              <span>Filename</span>
              <input
                value={editor.filename}
                required
                maxLength={180}
                onChange={(event) => setEditFilename(event.target.value)}
              />
            </label>
            <label className="dialog-field">
              <span>Tags</span>
              <TagEditor
                tags={editor.tags}
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
