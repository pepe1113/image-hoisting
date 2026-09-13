import { Code, Link, Pencil, Trash2 } from "lucide-react";
import { CheckIcon, CopyIcon } from "../../components/icons";
import { formatBytes, formatDate, imageName, markdownForImage } from "../../core";
import type { GalleryView, ImageRecord } from "../../types";
import type { ImageLibrarySession } from "./useImageLibrary";

interface ImageRowProps {
  session: ImageLibrarySession;
  view: GalleryView;
  image: ImageRecord;
  onCopy: (value: string, message: string) => void;
  onPreview: (image: ImageRecord) => void;
}

export function ImageRow({
  session,
  view,
  image,
  onCopy,
  onPreview,
}: ImageRowProps) {
  const { selectionMode, selectedKeys } = session.view;
  const { toggleImageSelection, openEditor, setDeleteTarget, setSearch } =
    session.actions;
  const selected = selectedKeys.has(image.key);

  return (
    <article className="image-row" data-selected={selected || undefined}>
      {selectionMode ? (
        <button
          className="selection-toggle"
          type="button"
          aria-label={`${selected ? "Deselect" : "Select"} ${image.filename}`}
          aria-pressed={selected}
          onClick={() => toggleImageSelection(image.key)}
        >
          {selected ? <CheckIcon /> : null}
        </button>
      ) : null}
      <button
        className="image-frame"
        type="button"
        aria-label={`View ${image.filename} full size`}
        onClick={() => onPreview(image)}
      >
        <img src={image.url} alt={image.filename} loading="lazy" />
      </button>
      <div className="image-info">
        <div className="image-details">
          <div className="image-title">
            <strong className="image-name" title={imageName(image)}>
              {imageName(image)}
            </strong>
            {image.contentType?.startsWith("image/") ? (
              <span className="image-format">{image.contentType.slice(6)}</span>
            ) : null}
          </div>
          <p className="image-meta">
            <span>{formatDate(image.uploadedAt)}</span>
            <span>{formatBytes(image.size)}</span>
            <span>
              {image.width && image.height && `${image.width}×${image.height}`}
            </span>
          </p>
          {image.folder ? (
            <span className="image-folder">{image.folder}</span>
          ) : null}
        </div>
        <div className="image-tags">
          {image.tags.length ? (
            image.tags.map((tag) => (
              <button type="button" key={tag} onClick={() => setSearch(tag)}>
                {tag}
              </button>
            ))
          ) : (
            <span className="no-tags">--</span>
          )}
        </div>
        <div className="image-links">
          <span className="image-url" title={image.url}>
            {image.url}
          </span>
          <button
            className="button button-secondary"
            type="button"
            aria-label={`Copy URL for ${image.filename}`}
            title="Copy URL"
            onClick={() => onCopy(image.url, "Image URL copied")}
          >
            <Link className="button-icon" aria-hidden="true" /> URL
          </button>
          {view === "list" ? (
            <button
              className="button button-secondary"
              type="button"
              aria-label={`Copy Markdown for ${image.filename}`}
              title="Copy Markdown"
              onClick={() => onCopy(markdownForImage(image), "Markdown copied")}
            >
              <Code className="button-icon" aria-hidden="true" /> MD
            </button>
          ) : null}
        </div>
      </div>
      <div className="image-actions">
        {view === "grid" ? (
          <button
            className="button button-primary copy-action"
            type="button"
            aria-label={`Copy Markdown for ${image.filename}`}
            onClick={() => onCopy(markdownForImage(image), "Markdown copied")}
          >
            <CopyIcon />
            <span className="button-label">Copy Markdown</span>
          </button>
        ) : null}
        <button
          className="button button-secondary icon-action"
          type="button"
          aria-label={`Edit ${image.filename}`}
          title="Edit image"
          onClick={() => openEditor(image)}
        >
          <Pencil className="button-icon" aria-hidden="true" />
        </button>
        <button
          className="button button-secondary icon-action"
          type="button"
          aria-label={`Delete ${image.filename}`}
          title="Delete image"
          onClick={() => setDeleteTarget(image)}
        >
          <Trash2 className="button-icon" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}
