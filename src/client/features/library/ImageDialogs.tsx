import { Modal } from "../../components/Modal";
import { TagEditor } from "../../components/TagEditor";
import type { ImageLibraryController } from "./useImageLibrary";

interface ImageDialogsProps {
  library: ImageLibraryController;
  profileLabel: string;
}

export function ImageDialogs({
  library,
  profileLabel,
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
              <TagEditor tags={editTags} onChange={setEditTags} />
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
