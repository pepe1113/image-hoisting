import { useState } from "react";
import {
  BrandIcon,
  KeyIcon,
  MenuIcon,
  PlusIcon,
  ProfileIcon,
  SettingsIcon,
  ThemeIcon,
} from "./icons";
import type { ImageProfile, WorkspaceTab } from "../types";

interface AppHeaderProps {
  tab: WorkspaceTab;
  profiles: ImageProfile[];
  activeProfileId: string;
  resolvedDark: boolean;
  hasAdminToken: boolean;
  onNavigate: (tab: WorkspaceTab) => void;
  onProfileChange: (profileId: string) => void;
  onAddProfile: () => void;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onOpenAdminKey: () => void;
}

export function AppHeader({
  tab,
  profiles,
  activeProfileId,
  resolvedDark,
  hasAdminToken,
  onNavigate,
  onProfileChange,
  onAddProfile,
  onToggleTheme,
  onOpenSettings,
  onOpenAdminKey,
}: AppHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const canSwitchProfile = profiles.length > 1;

  function closeMenuAfter(action: () => void): void {
    action();
    setMobileMenuOpen(false);
  }

  return (
    <header className="app-header">
      <a className="brand" href="/" aria-label="Image Hosting home">
        <span className="brand-mark">
          <BrandIcon />
        </span>
        <span>
          <strong>Image Hosting</strong>
          <small>Cloudflare R2</small>
        </span>
      </a>
      <button
        className="mobile-menu-toggle"
        type="button"
        aria-expanded={mobileMenuOpen}
        aria-controls="header-menu"
        aria-label={
          mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"
        }
        onClick={() => setMobileMenuOpen((open) => !open)}
      >
        <MenuIcon open={mobileMenuOpen} />
      </button>
      <div
        className={`header-menu${mobileMenuOpen ? " is-open" : ""}`}
        id="header-menu"
      >
        <nav className="header-nav" aria-label="Workspace" data-active={tab}>
          <button
            type="button"
            aria-current={tab === "upload" ? "page" : undefined}
            onClick={() => closeMenuAfter(() => onNavigate("upload"))}
          >
            Upload
          </button>
          <button
            type="button"
            aria-current={tab === "history" ? "page" : undefined}
            onClick={() => closeMenuAfter(() => onNavigate("history"))}
          >
            History
          </button>
        </nav>
        <div className="header-actions">
          <div className="profile-control">
            <label
              className={`profile-switcher${canSwitchProfile ? "" : " is-disabled"}`}
            >
              <span className="profile-icon">
                <ProfileIcon />
              </span>
              <span className="profile-switcher-copy">
                <span className="profile-caption">Current profile</span>
                <select
                  value={activeProfileId}
                  onChange={(event) => onProfileChange(event.target.value)}
                  disabled={!canSwitchProfile}
                  title={
                    canSwitchProfile
                      ? "Switch profile"
                      : "No other profiles available"
                  }
                  aria-label="Active profile"
                >
                  {profiles.length > 0 ? (
                    profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.label}
                      </option>
                    ))
                  ) : (
                    <option value={activeProfileId}>Loading…</option>
                  )}
                </select>
              </span>
            </label>
            <button
              className="icon-button add-profile-button"
              type="button"
              title="Add profile"
              aria-label="Add profile"
              onClick={() => closeMenuAfter(onAddProfile)}
            >
              <PlusIcon />
            </button>
          </div>
          <div className="header-tools" aria-label="Workspace tools">
            <button
              className="icon-button utility-button"
              type="button"
              title={
                resolvedDark ? "Switch to light mode" : "Switch to dark mode"
              }
              aria-label={
                resolvedDark ? "Switch to light mode" : "Switch to dark mode"
              }
              onClick={() => closeMenuAfter(onToggleTheme)}
            >
              <ThemeIcon dark={resolvedDark} />
            </button>
            <button
              className="icon-button utility-button"
              type="button"
              title="Open settings"
              aria-label="Open settings"
              onClick={() => closeMenuAfter(onOpenSettings)}
            >
              <SettingsIcon />
            </button>
            <button
              className={`icon-button key-button utility-button${hasAdminToken ? " is-authenticated" : ""}`}
              type="button"
              title={hasAdminToken ? "Admin key saved" : "Set admin key"}
              aria-label={hasAdminToken ? "Manage admin key" : "Set admin key"}
              onClick={() => closeMenuAfter(onOpenAdminKey)}
            >
              <KeyIcon />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
