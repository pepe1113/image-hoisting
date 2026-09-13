import type { WorkspaceLimits } from "@image-hoisting/contracts";
import type { ProfilePreferences } from "../../types";
import { UploadPicker } from "./UploadPicker";
import { UploadResult } from "./UploadResult";
import type { UploadSession } from "./useUpload";

interface UploadPanelProps {
  session: UploadSession;
  preferences: ProfilePreferences;
  profileLabel: string;
  limits: WorkspaceLimits;
  onCopy: (value: string, message: string) => void;
  activeProfileLabel: string;
}

export function UploadPanel({
  session,
  preferences,
  profileLabel,
  limits,
  onCopy,
  activeProfileLabel,
}: UploadPanelProps) {
  const { progress, result } = session.view;

  return (
    <section className="upload-section tab-panel" aria-label="Upload images">
      <section className="workspace-heading" aria-labelledby="page-title">
        <mark className="eyebrow">PERSONAL IMAGE TOOL</mark>
        <h1 id="page-title">Upload images.</h1>
        <p>
          Drop, paste, resize, and upload to{" "}
          <mark className="active-profile-name">{activeProfileLabel}</mark>.
        </p>
      </section>
      <form onSubmit={session.actions.handlePrepare}>
        <UploadPicker
          session={session}
          preferences={preferences}
          profileLabel={profileLabel}
          limits={limits}
        />
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
        {result ? <UploadResult image={result} onCopy={onCopy} /> : null}
      </form>
    </section>
  );
}
