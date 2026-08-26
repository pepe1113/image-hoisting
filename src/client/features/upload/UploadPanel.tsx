import { TagEditor } from "../../components/TagEditor";
import { formatBytes } from "../../core";
import type { ProfilePreferences } from "../../types";
import { ProcessingDialog } from "./ProcessingDialog";
import { UploadResult } from "./UploadResult";
import type { UploadController } from "./useUpload";

interface UploadPanelProps {
  upload: UploadController;
  preferences: ProfilePreferences;
  onOpenSettings: () => void;
  onCopy: (value: string, message: string) => void;
}

export function UploadPanel({
  upload,
  preferences,
  onOpenSettings,
  onCopy,
}: UploadPanelProps) {
  const {
    selectedFile,
    displayFilename,
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
    generateName,
    handlePrepare,
    startUpload,
  } = upload;

  return (
    <>
      <section className="upload-section tab-panel" aria-label="Upload images">
        <form onSubmit={handlePrepare}>
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
                <img
                  src={previewUrl}
                  alt="Preview of the image ready to upload"
                />
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
                      onChange={(event) => {
                        setDisplayFilename(event.target.value);
                        setAutoNamed(false);
                      }}
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
                  <TagEditor tags={uploadTags} onChange={setUploadTags} />
                </label>
                <div className="processing-summary">
                  <span>
                    {preferences.resizePreset === "original"
                      ? "Original image"
                      : `Max ${preferences.maxDimension}px · WebP ${preferences.quality}%`}
                  </span>
                  <button type="button" onClick={onOpenSettings}>
                    Change
                  </button>
                </div>
              </div>
            </div>
          )}
          {progress !== null ? (
            <div className="upload-progress">
              <div className="progress-copy">
                <span>{progress < 100 ? "Uploading" : "Upload complete"}</span>
                <strong>{progress}%</strong>
              </div>
              <div
                className="progress-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <span style={{ transform: `scaleX(${progress / 100})` }} />
              </div>
            </div>
          ) : null}
          {uploadResult ? (
            <UploadResult image={uploadResult} onCopy={onCopy} />
          ) : null}
        </form>
      </section>
      {prepared ? (
        <ProcessingDialog
          prepared={prepared}
          previewUrl={previewUrl}
          filename={displayFilename}
          onCancel={() => setPrepared(null)}
          onUpload={startUpload}
        />
      ) : null}
    </>
  );
}
