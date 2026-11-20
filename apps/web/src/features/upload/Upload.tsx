import type { WorkspaceLimits } from "@image-hoisting/contracts";
import type { ProfilePreferences } from "../../types";
import { ProcessingDialog } from "./ProcessingDialog";
import { UploadPanel } from "./UploadPanel";
import { useUpload } from "./useUpload";

interface UploadProps {
  enabled: boolean;
  profileId: string;
  profileLabel: string;
  activeProfileLabel: string;
  limits: WorkspaceLimits;
  preferences: ProfilePreferences;
  onPreferences: (preferences: ProfilePreferences) => void;
  setNotice: (message: string) => void;
  setToast: (message: string) => void;
  requestErrorMessage: (error: unknown, fallback: string) => string;
  trackUpload: <T>(upload: Promise<T>) => Promise<T>;
  onCopy: (value: string, message: string) => void;
}

export function Upload({
  enabled,
  profileId,
  profileLabel,
  activeProfileLabel,
  limits,
  preferences,
  onPreferences,
  setNotice,
  setToast,
  requestErrorMessage,
  trackUpload,
  onCopy,
}: UploadProps) {
  const session = useUpload({
      profileId,
    preferences,
    maxUploadBytes: limits.maxUploadBytes,
    setNotice,
    setToast,
    requestErrorMessage,
    trackUpload,
    onPreferences,
  });

  if (!enabled) return null;

  return (
    <>
      <UploadPanel
        session={session}
        preferences={preferences}
        profileLabel={profileLabel}
        activeProfileLabel={activeProfileLabel}
        limits={limits}
        onCopy={onCopy}
      />
      {session.view.prepared ? (
        <ProcessingDialog
          prepared={session.view.prepared}
          previewUrl={session.view.previewUrl}
          filename={session.view.displayFilename}
          onCancel={session.actions.cancelPreparation}
          onUpload={session.actions.startUpload}
        />
      ) : null}
    </>
  );
}
