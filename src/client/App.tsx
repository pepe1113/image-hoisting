import { useState } from "react";
import { AppHeader } from "./components/AppHeader";
import { AdminKeyDialog } from "./features/auth/AdminKeyDialog";
import { ImageDialogs } from "./features/library/ImageDialogs";
import { LibraryPanel } from "./features/library/LibraryPanel";
import { useImageLibrary } from "./features/library/useImageLibrary";
import { ProfileSetupDialog } from "./features/profiles/ProfileSetupDialog";
import { SettingsDialog } from "./features/settings/SettingsDialog";
import { UploadPanel } from "./features/upload/UploadPanel";
import { useUpload } from "./features/upload/useUpload";
import { useNotifications } from "./hooks/useNotifications";
import { useSettings } from "./hooks/useSettings";
import { useWorkspaceAccess } from "./hooks/useWorkspaceAccess";
import type { AppSettings, WorkspaceTab } from "./types";

export function App() {
  const [tab, setTab] = useState<WorkspaceTab>("upload");
  const [settingsOpen, setSettingsOpen] = useState(false);
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
    enabled: tab === "history",
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

  function importSettings(imported: AppSettings): void {
    settings.importKnownSettings(imported, access.profiles);
    notifications.setToast("Settings imported");
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
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenAdminKey={() => access.setAdminDialogOpen(true)}
      />

      <section className="workspace-heading" aria-labelledby="page-title">
        <mark className="eyebrow">PERSONAL IMAGE TOOL</mark>
        <h1 id="page-title">Upload images.</h1>
        <p>
          Drop, paste, resize, and upload to{" "}
          {access.activeProfile?.label ?? "your R2 bucket"}.
        </p>
      </section>

      {notifications.notice ? (
        <div className="notice" role="alert">
          {notifications.notice}
        </div>
      ) : null}

      {tab === "upload" ? (
        <UploadPanel
          upload={upload}
          preferences={settings.preferences}
          onOpenSettings={() => setSettingsOpen(true)}
          onCopy={notifications.copyText}
        />
      ) : (
        <LibraryPanel
          library={library}
          profileLabel={profileLabel}
          view={settings.preferences.view}
          onViewChange={settings.setView}
          onCopy={notifications.copyText}
        />
      )}

      <footer className="app-footer">
        <span>Self-hosted image workspace</span>
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
      {settingsOpen ? (
        <SettingsDialog
          settings={settings.settings}
          preferences={settings.preferences}
          profileLabel={access.activeProfile?.label ?? "Default"}
          onTheme={settings.setTheme}
          onPreferences={settings.updatePreferences}
          onImport={importSettings}
          onExport={settings.exportSettings}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
      <ImageDialogs library={library} profileLabel={profileLabel} />
      {notifications.toast ? (
        <div className="toast" role="status" aria-live="polite">
          {notifications.toast}
        </div>
      ) : null}
    </main>
  );
}
