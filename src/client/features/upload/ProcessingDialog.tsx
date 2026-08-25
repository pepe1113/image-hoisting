import { Modal } from "../../components/Modal";
import { formatBytes } from "../../core";
import type { PreparedImage } from "../../types";

interface ProcessingDialogProps {
  prepared: PreparedImage;
  previewUrl: string;
  filename: string;
  onCancel: () => void;
  onUpload: (processed: boolean) => void;
}

export function ProcessingDialog({
  prepared,
  previewUrl,
  filename,
  onCancel,
  onUpload,
}: ProcessingDialogProps) {
  const dimensions =
    prepared.sourceWidth && prepared.sourceHeight
      ? `${prepared.sourceWidth}×${prepared.sourceHeight} → ${prepared.outputWidth}×${prepared.outputHeight}`
      : "Original dimensions preserved";
  const saving =
    prepared.savedPercent >= 0
      ? `${prepared.savedPercent}% saved`
      : `${Math.abs(prepared.savedPercent)}% larger`;

  return (
    <Modal title="Image processing preview" onClose={onCancel}>
      <div className="processing-preview">
        <img src={previewUrl} alt={`Preview of ${filename}`} />
        <div>
          <strong>{filename}</strong>
          <span>
            {formatBytes(prepared.source.size)} →{" "}
            {formatBytes(prepared.processed.size)}
          </span>
          <span>{dimensions}</span>
        </div>
        <strong
          className={
            prepared.savedPercent >= 0 ? "saving-positive" : "saving-negative"
          }
        >
          {saving}
        </strong>
      </div>
      <div className="processing-stats">
        <span>Resize</span>
        <strong>{prepared.scalePercent}%</strong>
        <span>File size</span>
        <strong>{saving}</strong>
      </div>
      {prepared.warning ? (
        <p className="inline-warning">{prepared.warning}</p>
      ) : null}
      <div className="dialog-actions">
        <button
          className="button button-secondary"
          type="button"
          onClick={onCancel}
        >
          Cancel
        </button>
        {prepared.changed && prepared.savedPercent < 0 ? (
          <>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => onUpload(true)}
            >
              Upload processed anyway
            </button>
            <button
              className="button button-primary"
              type="button"
              onClick={() => onUpload(false)}
            >
              Upload original image
            </button>
          </>
        ) : (
          <>
            {prepared.changed ? (
              <button
                className="button button-secondary"
                type="button"
                onClick={() => onUpload(false)}
              >
                Upload original
              </button>
            ) : null}
            <button
              className="button button-primary"
              type="button"
              onClick={() => onUpload(prepared.changed)}
            >
              {prepared.changed
                ? "Upload processed image"
                : "Upload original image"}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
