import type { WorkspaceLimits } from "@image-hoisting/contracts";
import { TagEditor } from "../../components/TagEditor";
import { formatBytes } from "../../core";
import type { ProfilePreferences } from "../../types";
import { ProcessingControls } from "./ProcessingControls";
import type { UploadSession } from "./useUpload";

interface UploadPickerProps {
  session: UploadSession;
  preferences: ProfilePreferences;
  profileLabel: string;
  limits: WorkspaceLimits;
}

export function UploadPicker({
  session,
  preferences,
  profileLabel,
  limits,
}: UploadPickerProps) {
  const {
    selectedFile,
    displayFilename,
    tags,
    preparing,
    dragging,
    previewUrl,
  } = session.view;
  const {
    selectFile,
    clearSelection,
    setDisplayFilename,
    setTags,
    setDragging,
    setDimensions,
    generateName,
  } = session.actions;

  return (
    <>
      <input
        id="file-input"
        className="visually-hidden"
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) selectFile(file);
          event.target.value = "";
        }}
      />
      {!selectedFile ? (
        <label
          className={`drop-zone${dragging ? " is-dragging" : ""}`}
          htmlFor="file-input"
          tabIndex={0}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files[0];
            if (file) selectFile(file);
          }}
        >
          <span className="drop-blob" aria-hidden="true" />
          <span className="drop-copy">
            <span className="drop-kicker">DROP IT HERE</span>
            <strong>Drop or paste an image</strong>
            <span>
              Click to browse or press <kbd>⌘V</kbd> / <kbd>Ctrl+V</kbd>
            </span>
            <small>JPG, PNG, GIF, WebP, AVIF</small>
          </span>
        </label>
      ) : (
        <div className="selected-file">
          <a
            className="selected-preview"
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open full-size preview of ${selectedFile.name}`}
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Preview of the image ready to upload"
                onLoad={(event) =>
                  setDimensions(
                    selectedFile,
                    event.currentTarget.naturalWidth,
                    event.currentTarget.naturalHeight,
                  )
                }
              />
            ) : null}
          </a>
          <div className="selected-file-details">
            <div className="selected-file-header">
              <div className="selected-copy">
                <strong>{selectedFile.name}</strong>
                <span>
                  {formatBytes(selectedFile.size)} / {selectedFile.type}
                </span>
              </div>
              <div className="selected-actions">
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={clearSelection}
                >
                  Remove
                </button>
                <button
                  className="button button-primary"
                  type="submit"
                  disabled={preparing}
                >
                  {preparing ? "Processing…" : "Review upload"}
                </button>
              </div>
            </div>
            <label className="upload-filename">
              <span>Display filename</span>
              <span className="filename-row">
                <input
                  value={displayFilename}
                  maxLength={180}
                  placeholder="Leave blank to auto rename"
                  onChange={(event) => setDisplayFilename(event.target.value)}
                />
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={generateName}
                >
                  Generate
                </button>
              </span>
            </label>
            <label className="upload-tags">
              <span>Tags (optional)</span>
              <TagEditor
                tags={tags}
                maxTags={limits.maxTags}
                maxTagLength={limits.maxTagLength}
                onChange={setTags}
              />
            </label>
            <ProcessingControls
              session={session}
              preferences={preferences}
              profileLabel={profileLabel}
            />
          </div>
        </div>
      )}
    </>
  );
}
