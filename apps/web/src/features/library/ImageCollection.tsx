import { useEffect, useRef, useState } from "react";
import { Modal } from "../../components/Modal";
import { imageName } from "../../core";
import type { GalleryView, ImageRecord } from "../../types";
import { ImageRow } from "./ImageRow";
import type { ImageLibrarySession } from "./useImageLibrary";

interface ImageCollectionProps {
  session: ImageLibrarySession;
  view: GalleryView;
  onCopy: (value: string, message: string) => void;
}

export function ImageCollection({
  session,
  view,
  onCopy,
}: ImageCollectionProps) {
  const [preview, setPreview] = useState<ImageRecord | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const {
    search,
    folder,
    images,
    total,
    hasMore,
    loading,
    selectionMode,
    allImagesSelected,
  } = session.view;

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) session.actions.loadMore();
      },
      { rootMargin: "300px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, session.actions.loadMore]);

  return (
    <>
      {loading && images.length === 0 ? (
        <div className="gallery skeleton-grid">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="skeleton" key={index} />
          ))}
        </div>
      ) : null}
      {!loading && images.length === 0 ? (
        <div className="empty-state">
          <h3>
            {search || folder !== null
              ? "No matching images"
              : "Your history is empty"}
          </h3>
          <p>
            {search || folder !== null
              ? "Try another tag or folder."
              : "Choose Upload in the navigation to add your first image."}
          </p>
        </div>
      ) : null}
      {images.length > 0 ? (
        <div
          className="gallery"
          data-view={view}
          data-selecting={selectionMode || undefined}
        >
          {view === "list" ? (
            <div className="library-columns">
              {selectionMode ? (
                <input
                  className="library-select-all"
                  type="checkbox"
                  aria-label="Select all"
                  checked={allImagesSelected}
                  onChange={session.actions.toggleSelectAll}
                />
              ) : null}
              <span className="library-columns-file">File &amp; specs</span>
              <span>Tags</span>
              <span>Links &amp; copy</span>
              <span>Actions</span>
            </div>
          ) : null}
          {images.map((image) => (
            <ImageRow
              key={`${image.profileId}:${image.key}`}
              session={session}
              view={view}
              onCopy={onCopy}
              image={image}
              onPreview={setPreview}
            />
          ))}
        </div>
      ) : null}
      {total > 0 ? (
        <div ref={loadMoreRef} className="library-footer" aria-live="polite">
          {loading
            ? "Loading more images…"
            : hasMore
              ? `Showing ${images.length} of ${total} images`
              : `Showing all ${images.length} images`}
        </div>
      ) : null}
      {preview ? (
        <Modal
          title={imageName(preview)}
          variant="lightbox"
          onClose={() => setPreview(null)}
        >
          <img src={preview.url} alt={imageName(preview)} />
        </Modal>
      ) : null}
    </>
  );
}
