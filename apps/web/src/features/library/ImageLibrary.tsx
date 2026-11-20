import type { WorkspaceLimits } from "@image-hoisting/contracts";
import type { GalleryView } from "../../types";
import { ImageDialogs } from "./ImageDialogs";
import { LibraryPanel } from "./LibraryPanel";
import { useImageLibrary } from "./useImageLibrary";

interface ImageLibraryProps {
  enabled: boolean;
  profileId: string;
  profileLabel: string;
  limits: WorkspaceLimits;
  view: GalleryView;
  setNotice: (message: string) => void;
  setToast: (message: string) => void;
  copyText: (value: string, message: string) => Promise<void>;
  requestErrorMessage: (error: unknown, fallback: string) => string;
}

export function ImageLibrary({
  enabled,
  profileId,
  profileLabel,
  limits,
  view,
  setNotice,
  setToast,
  copyText,
  requestErrorMessage,
}: ImageLibraryProps) {
  const session = useImageLibrary({
    enabled,
      profileId,
    setNotice,
    setToast,
    copyText,
    requestErrorMessage,
  });

  if (!enabled) return null;

  return (
    <>
      <LibraryPanel
        session={session}
        profileLabel={profileLabel}
        view={view}
        onCopy={copyText}
      />
      <ImageDialogs
        session={session}
        profileLabel={profileLabel}
        limits={limits}
      />
    </>
  );
}
