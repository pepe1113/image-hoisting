import { useState } from "react";
import { AppHeader } from "./components/AppHeader";
import { AdminKeyDialog } from "./features/auth/AdminKeyDialog";
import { ImageLibrary } from "./features/library/ImageLibrary";
import { ProfileSetupDialog } from "./features/profiles/ProfileSetupDialog";
import { Upload } from "./features/upload/Upload";
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
  const profileLabel = access.activeProfile?.label ?? "R2";

  function changeProfile(profileId: string): void {
    settings.setActiveProfileId(profileId);
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

      <Upload
        key={`upload:${settings.activeProfileId}`}
        enabled={tab === "upload"}
        token={access.token}
        profileId={settings.activeProfileId}
        profileLabel={profileLabel}
        activeProfileLabel={access.activeProfile?.label ?? "your R2 bucket"}
        limits={access.limits}
        preferences={settings.preferences}
        onPreferences={settings.updatePreferences}
        setNotice={notifications.setNotice}
        setToast={notifications.setToast}
        requestErrorMessage={access.requestErrorMessage}
        onCopy={notifications.copyText}
      />
      <ImageLibrary
        key={`library:${settings.activeProfileId}`}
        enabled={tab !== "upload"}
        token={access.token}
        profileId={settings.activeProfileId}
        profileLabel={profileLabel}
        limits={access.limits}
        view={tab === "gallery" ? "grid" : "list"}
        setNotice={notifications.setNotice}
        setToast={notifications.setToast}
        copyText={notifications.copyText}
        requestErrorMessage={access.requestErrorMessage}
      />

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
      {notifications.toast ? (
        <div className="toast" role="status" aria-live="polite">
          {notifications.toast}
        </div>
      ) : null}
    </main>
  );
}
