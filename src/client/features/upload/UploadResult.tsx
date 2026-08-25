import { formatBytes, formatDate, markdownForImage } from "../../core";
import type { ImageRecord } from "../../types";

interface UploadResultProps {
  image: ImageRecord;
  onCopy: (value: string, message: string) => void;
}

export function UploadResult({ image, onCopy }: UploadResultProps) {
  return (
    <section className="upload-result" aria-labelledby="upload-result-title">
      <div className="result-heading">
        <span className="result-kicker">UPLOAD COMPLETE</span>
        <div>
          <h2 id="upload-result-title">Your image is ready.</h2>
          <p>Choose what you want to copy.</p>
        </div>
      </div>
      <div className="result-card">
        <a
          className="result-preview"
          href={image.url}
          target="_blank"
          rel="noreferrer"
        >
          <img src={image.url} alt={image.filename} />
        </a>
        <div className="result-details">
          <div className="result-file">
            <strong>{image.filename}</strong>
            <span>
              {formatBytes(image.size)} / {formatDate(image.uploadedAt)}
            </span>
          </div>
          <div className="result-field">
            <span>Markdown</span>
            <div className="copy-field">
              <code>{markdownForImage(image)}</code>
              <button
                className="button button-secondary"
                type="button"
                onClick={() =>
                  onCopy(markdownForImage(image), "Markdown copied")
                }
              >
                Copy
              </button>
            </div>
          </div>
          <div className="result-field">
            <span>Image URL</span>
            <div className="copy-field">
              <code>{image.url}</code>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => onCopy(image.url, "Image URL copied")}
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
