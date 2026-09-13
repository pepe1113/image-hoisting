import { formatBytes } from "../../core";
import type { GalleryView } from "../../types";
import { ImageCollection } from "./ImageCollection";
import { LibraryToolbar } from "./LibraryToolbar";
import type { ImageLibrarySession } from "./useImageLibrary";

interface LibraryPanelProps {
  session: ImageLibrarySession;
  profileLabel: string;
  view: GalleryView;
  onCopy: (value: string, message: string) => void;
}

export function LibraryPanel({
  session,
  profileLabel,
  view,
  onCopy,
}: LibraryPanelProps) {
  const { summary, loading } = session.view;

  return (
    <section
      className="library-section tab-panel"
      data-view={view}
      aria-label={view === "grid" ? "Image gallery" : "Image list"}
      aria-busy={loading}
    >
      <div className="library-heading workspace-heading">
        <div>
          <mark className="eyebrow">PERSONAL IMAGE TOOL</mark>
          <h1 id="page-title">
            {view === "grid" ? "Gallery." : "Image list."}
          </h1>
          <p>
            Images stored in{" "}
            <mark className="active-profile-name">{profileLabel}</mark>. Copy,
            edit, and manage your images.
          </p>
        </div>
        <dl className="library-stats" aria-label="Profile image statistics">
          <div>
            <dt>Total files</dt>
            <dd>{summary?.total.toLocaleString("en-US") ?? "—"}</dd>
          </div>
          <div>
            <dt>Bucket size</dt>
            <dd>{summary ? formatBytes(summary.totalBytes) : "—"}</dd>
          </div>
        </dl>
      </div>
      <LibraryToolbar session={session} view={view} />
      <ImageCollection session={session} view={view} onCopy={onCopy} />
    </section>
  );
}
