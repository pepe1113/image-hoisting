import { useState } from "react";
import { TagEditor } from "../../components/TagEditor";
import { Tooltip } from "../../components/Tooltip";
import {
  calculateTargetSize,
  formatBytes,
  PROCESSING_PRESETS,
} from "../../core";
import type {
  OutputFormat,
  ProcessingPreset,
  ProfilePreferences,
  SharpenLevel,
} from "../../types";
import type { WorkspaceLimits } from "@image-hoisting/contracts";
import { ProcessingDialog } from "./ProcessingDialog";
import { UploadResult } from "./UploadResult";
import type { UploadController } from "./useUpload";

interface UploadPanelProps {
  upload: UploadController;
  preferences: ProfilePreferences;
  profileLabel: string;
  limits: WorkspaceLimits;
  onPreferences: (preferences: ProfilePreferences) => void;
  onCopy: (value: string, message: string) => void;
  profileId: string;
  activeProfileLabel: string;
}

interface MeasuredImage {
  file: File;
  width: number;
  height: number;
}

export function UploadPanel({
  upload,
  preferences,
  profileLabel,
  limits,
  onPreferences,
  onCopy,
  profileId,
  activeProfileLabel,
}: UploadPanelProps) {
  const [measuredImage, setMeasuredImage] = useState<MeasuredImage | null>(
    null,
  );
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
  const sourceDimensions =
    measuredImage?.file === selectedFile ? measuredImage : null;
  const isGif = selectedFile?.type === "image/gif";
  const effectiveOutputFormat = isGif ? "original" : preferences.outputFormat;
  const processingDisabled = isGif || effectiveOutputFormat === "original";
  const outputDimensions = sourceDimensions
    ? processingDisabled
      ? { width: sourceDimensions.width, height: sourceDimensions.height }
      : calculateTargetSize(
          sourceDimensions.width,
          sourceDimensions.height,
          preferences.maxDimension,
        )
    : null;

  function setPreset(preset: ProcessingPreset): void {
    const presetValues = preset === "custom" ? {} : PROCESSING_PRESETS[preset];
    onPreferences({
      ...preferences,
      ...presetValues,
      processingPreset: preset,
    });
  }

  function customize(changes: Partial<ProfilePreferences>): void {
    onPreferences({ ...preferences, ...changes, processingPreset: "custom" });
  }

  return (
    <>
      <section className="upload-section tab-panel" aria-label="Upload images">
        <section className="workspace-heading" aria-labelledby="page-title">
          <mark className="eyebrow">PERSONAL IMAGE TOOL</mark>
          <h1 id="page-title">Upload images.</h1>
          <p>
            Drop, paste, resize, and upload to{" "}
            <mark className="active-profile-name" key={profileId}>
              {activeProfileLabel}
            </mark>
            .
          </p>
        </section>
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
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Preview of the image ready to upload"
                    onLoad={(event) => {
                      setMeasuredImage({
                        file: selectedFile,
                        width: event.currentTarget.naturalWidth,
                        height: event.currentTarget.naturalHeight,
                      });
                    }}
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
                  <TagEditor
                    tags={uploadTags}
                    maxTags={limits.maxTags}
                    maxTagLength={limits.maxTagLength}
                    onChange={setUploadTags}
                  />
                </label>
                <fieldset className="upload-processing">
                  <legend>Processing for {profileLabel}</legend>
                  <div className="processing-control">
                    <span className="processing-control-label">
                      <label htmlFor="processing-preset">Preset</label>
                      <Tooltip content="Choose a starting point. Changing any setting switches the preset to Custom." />
                    </span>
                    <select
                      id="processing-preset"
                      value={preferences.processingPreset}
                      disabled={processingDisabled}
                      onChange={(event) =>
                        setPreset(event.target.value as ProcessingPreset)
                      }
                    >
                      <option value="high">High · 2048 / 85 / Mid</option>
                      <option value="standard">
                        Standard · 1600 / 80 / Low
                      </option>
                      <option value="fast">Fast · 1000 / 70 / Off</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <div className="processing-sliders">
                    <div className="processing-slider">
                      <span className="processing-control-label">
                        <label htmlFor="maximum-long-edge">
                          Maximum long edge
                        </label>
                        <Tooltip content="Limits the longest edge and reduces both dimensions proportionally. Smaller images are not enlarged." />
                        <output>{preferences.maxDimension}px</output>
                      </span>
                      <input
                        id="maximum-long-edge"
                        aria-label="Maximum long edge"
                        type="range"
                        min="320"
                        max="8192"
                        step="1"
                        value={preferences.maxDimension}
                        disabled={processingDisabled}
                        onChange={(event) =>
                          customize({
                            maxDimension: Number(event.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="processing-slider">
                      <span className="processing-control-label">
                        <label htmlFor="webp-quality">WebP quality</label>
                        <Tooltip content="Controls lossy compression. 80–85 is a practical starting range, but the result varies by image." />
                        <output>{preferences.quality}%</output>
                      </span>
                      <input
                        id="webp-quality"
                        aria-label="WebP quality"
                        type="range"
                        min="10"
                        max="100"
                        step="1"
                        value={preferences.quality}
                        disabled={processingDisabled}
                        onChange={(event) =>
                          customize({
                            quality: Number(event.target.value),
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="processing-options">
                    <div className="processing-control">
                      <span className="processing-control-label">
                        <label htmlFor="sharpen-level">Sharpen</label>
                        <Tooltip content="Adds subtle edge contrast after resizing to recover some apparent detail." />
                      </span>
                      <select
                        id="sharpen-level"
                        value={preferences.sharpen}
                        disabled={processingDisabled}
                        onChange={(event) =>
                          customize({
                            sharpen: event.target.value as SharpenLevel,
                          })
                        }
                      >
                        <option value="off">Off</option>
                        <option value="low">Low</option>
                        <option value="mid">Mid</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                    <div className="processing-control">
                      <span className="processing-control-label">
                        <span id="output-format-label">Format</span>
                        <Tooltip content="WebP is often smaller. Original keeps the file byte-for-byte and skips resizing and sharpening." />
                      </span>
                      <div
                        className="format-toggle"
                        role="group"
                        aria-labelledby="output-format-label"
                      >
                        {(["original", "webp"] as const).map(
                          (format: OutputFormat) => (
                            <button
                              type="button"
                              className={
                                effectiveOutputFormat === format
                                  ? "is-active"
                                  : ""
                              }
                              aria-pressed={effectiveOutputFormat === format}
                              disabled={isGif}
                              key={format}
                              onClick={() =>
                                customize({ outputFormat: format })
                              }
                            >
                              {format === "original" ? "Original" : "WebP"}
                            </button>
                          ),
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="processing-dimensions" aria-live="polite">
                    <span>Proportional output</span>
                    <strong>
                      {sourceDimensions && outputDimensions
                        ? `${sourceDimensions.width}×${sourceDimensions.height} → ${outputDimensions.width}×${outputDimensions.height}px`
                        : "Reading image dimensions…"}
                    </strong>
                    <small>
                      {isGif
                        ? "Animated GIF stays in its original format."
                        : preferences.outputFormat === "original"
                          ? "Original keeps the file byte-for-byte."
                          : "The original aspect ratio is preserved."}
                    </small>
                  </div>
                </fieldset>
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
