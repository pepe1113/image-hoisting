import { useCallback, useEffect, useRef, useState } from "react";
import { fetchProfiles, SessionExpiredError } from "../api";
import { reloadPage } from "../navigation";
import type { ImageProfile } from "../types";
import {
  DEFAULT_WORKSPACE_LIMITS,
  type WorkspaceLimits,
} from "@image-hoisting/contracts";

interface UseWorkspaceAccessOptions {
  activeProfileId: string;
  onProfilesLoaded: (profiles: ImageProfile[]) => void;
  setNotice: (message: string) => void;
}

export function useWorkspaceAccess({
  activeProfileId,
  onProfilesLoaded,
  setNotice,
}: UseWorkspaceAccessOptions) {
  const [profiles, setProfiles] = useState<ImageProfile[]>([]);
  const [limits, setLimits] = useState<WorkspaceLimits>(DEFAULT_WORKSPACE_LIMITS);
  const uploadsInFlight = useRef(0);

  const requestErrorMessage = useCallback(
    (error: unknown, fallback: string): string => {
      if (error instanceof SessionExpiredError) {
        if (uploadsInFlight.current > 0) {
          return "Your login expired. Reload the page after the upload finishes.";
        }
        reloadPage();
        return "Your login expired. Reloading to sign in again…";
      }
      return error instanceof Error ? error.message : fallback;
    },
    [],
  );

  const trackUpload = useCallback(<T,>(upload: Promise<T>): Promise<T> => {
    uploadsInFlight.current += 1;
    return upload.finally(() => {
      uploadsInFlight.current -= 1;
    });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let ignore = false;
    fetchProfiles(controller.signal)
      .then(({ profiles: available, limits: serverLimits }) => {
        if (ignore) return;
        setProfiles(available);
        setLimits(serverLimits);
        onProfilesLoaded(available);
      })
      .catch((error: Error) => {
        if (ignore || error.name === "AbortError") return;
        setNotice(requestErrorMessage(error, "Could not load profiles."));
      });
    return () => {
      ignore = true;
      controller.abort();
    };
  }, [onProfilesLoaded, requestErrorMessage, setNotice]);

  const activeProfile =
    profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0];

  return {
    profiles,
    limits,
    activeProfile,
    requestErrorMessage,
    trackUpload,
  };
}
