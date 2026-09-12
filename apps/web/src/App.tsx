import { useState } from "react";
import { AppHeader } from "./components/AppHeader";
import { AdminKeyDialog } from "./features/auth/AdminKeyDialog";
import { ImageDialogs } from "./features/library/ImageDialogs";
import { LibraryPanel } from "./features/library/LibraryPanel";
import { useImageLibrary } from "./features/library/useImageLibrary";
import { ProfileSetupDialog } from "./features/profiles/ProfileSetupDialog";
import { UploadPanel } from "./features/upload/UploadPanel";
import { useUpload } from "./features/upload/useUpload";
import { useNotifications } from "./hooks/useNotifications";
import { useSettings } from "./hooks/useSettings";
import { useWorkspaceAccess } from "./hooks/useWorkspaceAccess";
import type { WorkspaceTab } from "./types";

export function App() {
  const [tab, setTab] = useState<WorkspaceTab>("upload");
  const [profileSetupOpen, setProfileSetupOpen] = useState(false);
  const notifications = useNotifications();
  const settings = useSettings();
  const access = useWorkspaceAccess({
    activeProfileId: settings.activeProfileId,
    onProfilesLoaded: settings.reconcileProfiles,
    setNotice: notifications.setNotice,
    setToast: notifications.setToast,
  });
  const library = useImageLibrary({
    enabled: tab !== "upload",
    token: access.token,
    profileId: settings.activeProfileId,
    setNotice: notifications.setNotice,
    setToast: notifications.setToast,
    copyText: notifications.copyText,
    requestErrorMessage: access.requestErrorMessage,
  });
  const upload = useUpload({
    token: access.token,
    profileId: settings.activeProfileId,
    preferences: settings.preferences,
    maxUploadBytes: access.limits.maxUploadBytes,
    setNotice: notifications.setNotice,
    setToast: notifications.setToast,
    requestErrorMessage: access.requestErrorMessage,
    onUploaded: library.refresh,
  });
  const profileLabel = access.activeProfile?.label ?? "R2";

  function changeProfile(profileId: string): void {
    settings.setActiveProfileId(profileId);
    library.resetForProfile();
    upload.reset();
    notifications.setNotice("");
  }

  return (
    <main className="app-shell" id="main-content">
      <AppHeader
        tab={tab}
        profiles={access.profiles}
        activeProfileId={settings.activeProfileId}
        resolvedDark={settings.resolvedDark}
        hasAdminToken={Boolean(access.token)}
        onNavigate={setTab}
        onProfileChange={changeProfile}
        onAddProfile={() => setProfileSetupOpen(true)}
        onToggleTheme={() =>
          settings.setTheme(settings.resolvedDark ? "light" : "dark")
        }
        onOpenAdminKey={() => access.setAdminDialogOpen(true)}
      />

      {notifications.notice ? (
        <div className="notice" role="alert">
          {notifications.notice}
        </div>
      ) : null}

      {tab === "upload" ? (
        <UploadPanel
          upload={upload}
          preferences={settings.preferences}
          profileLabel={profileLabel}
          limits={access.limits}
          onPreferences={settings.updatePreferences}
          profileId={settings.activeProfileId}
          activeProfileLabel={access.activeProfile?.label ?? "your R2 bucket"}
          onCopy={notifications.copyText}
        />
      ) : (
        <LibraryPanel
          library={library}
          profileLabel={profileLabel}
          view={tab === "gallery" ? "grid" : "list"}
          onCopy={notifications.copyText}
        />
      )}

      <footer className="app-footer">
        <span>
          Made by{" "}
          <a
            href="https://github.com/pepe1113"
            target="_blank"
            rel="noopener noreferrer"
          >
            @Pei Wang
          </a>{" "}
          , Self-hosted image workspace on{" "}
          <a
            href="https://github.com/pepe1113/image-hoisting"
            target="_blank"
            rel="noopener noreferrer"
          >
            Github
          </a>{" "}
          © 2026
        </span>
        <span>Cloudflare R2 + React</span>
      </footer>

      {access.adminDialogOpen ? (
        <AdminKeyDialog
          currentToken={access.token}
          onSave={access.saveAdminKey}
          onClear={access.removeAdminKey}
          onClose={() => access.setAdminDialogOpen(false)}
        />
      ) : null}
      {profileSetupOpen ? (
        <ProfileSetupDialog
          onCopy={notifications.copyText}
          onClose={() => setProfileSetupOpen(false)}
        />
      ) : null}
      <ImageDialogs
        library={library}
        profileLabel={profileLabel}
        limits={access.limits}
      />
      {notifications.toast ? (
        <div className="toast" role="status" aria-live="polite">
          {notifications.toast}
        </div>
      ) : null}
    </main>
  );
}
