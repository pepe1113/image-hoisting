import { useCallback, useEffect, useState } from "react";
import {
  fetchProfiles,
  isUnauthorized,
  verifyAdminToken,
} from "../api";
import {
  clearAdminToken,
  readAdminToken,
  saveAdminToken,
} from "../core";
import type { ImageProfile } from "../types";
import {
  DEFAULT_WORKSPACE_LIMITS,
  type WorkspaceLimits,
} from "../../shared/limits";

interface UseWorkspaceAccessOptions {
  activeProfileId: string;
  onProfilesLoaded: (profiles: ImageProfile[]) => void;
  setNotice: (message: string) => void;
  setToast: (message: string) => void;
}

interface AdminAuthState {
  token: string;
  dialogOpen: boolean;
}

export function useWorkspaceAccess({
  activeProfileId,
  onProfilesLoaded,
  setNotice,
  setToast,
}: UseWorkspaceAccessOptions) {
  const [adminAuth, setAdminAuth] = useState<AdminAuthState>(() => {
    const token = readAdminToken();
    return { token, dialogOpen: !token };
  });
  const [profiles, setProfiles] = useState<ImageProfile[]>([]);
  const [limits, setLimits] = useState<WorkspaceLimits>(DEFAULT_WORKSPACE_LIMITS);

  useEffect(() => {
    if (!adminAuth.token) return;
    const controller = new AbortController();
    let ignore = false;
    fetchProfiles(adminAuth.token, controller.signal)
      .then(({ profiles: available, limits: serverLimits }) => {
        if (ignore) return;
        setProfiles(available);
        setLimits(serverLimits);
        onProfilesLoaded(available);
      })
      .catch((error: Error) => {
        if (ignore || error.name === "AbortError") return;
        if (isUnauthorized(error)) {
          clearAdminToken();
          setAdminAuth({ token: "", dialogOpen: true });
          setProfiles([]);
        }
        setNotice(error.message);
      });
    return () => {
      ignore = true;
      controller.abort();
    };
  }, [
    adminAuth.token,
    onProfilesLoaded,
    setNotice,
  ]);

  const requestErrorMessage = useCallback(
    (error: unknown, fallback: string): string => {
      if (isUnauthorized(error)) {
        clearAdminToken();
        setAdminAuth({ token: "", dialogOpen: true });
        setProfiles([]);
        return "The saved admin key is invalid. Enter the current key to continue.";
      }
      return error instanceof Error ? error.message : fallback;
    },
    [],
  );

  async function saveKey(token: string): Promise<void> {
    await verifyAdminToken(token);
    saveAdminToken(token);
    setAdminAuth({ token, dialogOpen: false });
    setNotice("");
    setToast("Admin key verified and saved");
  }

  function removeKey(): void {
    clearAdminToken();
    setAdminAuth({ token: "", dialogOpen: true });
    setProfiles([]);
    setNotice("");
  }

  function setDialogOpen(dialogOpen: boolean): void {
    setAdminAuth((current) => ({ ...current, dialogOpen }));
  }

  const activeProfile =
    profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0];

  return {
    token: adminAuth.token,
    adminDialogOpen: adminAuth.dialogOpen,
    profiles,
    limits,
    activeProfile,
    setAdminDialogOpen: setDialogOpen,
    saveAdminKey: saveKey,
    removeAdminKey: removeKey,
    requestErrorMessage,
  };
}
