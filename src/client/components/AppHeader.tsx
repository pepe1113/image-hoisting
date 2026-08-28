import { useEffect, useRef, useState } from "react";
import {
  BrandIcon,
  CheckIcon,
  ChevronDownIcon,
  KeyIcon,
  MenuIcon,
  PlusIcon,
  ProfileIcon,
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
  onOpenAdminKey,
}: AppHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileTriggerRef = useRef<HTMLButtonElement>(null);
  const canSwitchProfile = profiles.length > 1;
  const activeProfile =
    profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0];

  useEffect(() => {
    if (!profileMenuOpen) return;

    function closeOnOutsideClick(event: PointerEvent): void {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [profileMenuOpen]);

  function closeMenuAfter(action: () => void): void {
    action();
    setMobileMenuOpen(false);
  }

  function focusProfileOption(index: number): void {
    queueMicrotask(() => {
      const options = profileMenuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="option"]',
      );
      options?.[index]?.focus();
    });
  }

  function handleProfileMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    const options = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]')];
    const currentIndex = options.indexOf(document.activeElement as HTMLButtonElement);

    if (event.key === "Escape") {
      event.preventDefault();
      setProfileMenuOpen(false);
      profileTriggerRef.current?.focus();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;

    event.preventDefault();
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? options.length - 1
        : (currentIndex + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
    options[nextIndex]?.focus();
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
            <div
              className={`profile-switcher${canSwitchProfile ? "" : " is-disabled"}`}
              ref={profileMenuRef}
            >
              <span className="profile-icon">
                <ProfileIcon />
              </span>
              <button
                className="profile-trigger"
                type="button"
                ref={profileTriggerRef}
                disabled={!canSwitchProfile}
                title={canSwitchProfile ? "Switch profile" : "No other profiles available"}
                aria-label={`Active profile: ${activeProfile?.label ?? "Loading"}`}
                aria-haspopup="listbox"
                aria-expanded={profileMenuOpen && canSwitchProfile}
                aria-controls="profile-menu"
                onClick={() => setProfileMenuOpen((open) => !open)}
                onKeyDown={(event) => {
                  if (event.key === "Escape" && profileMenuOpen) {
                    event.preventDefault();
                    setProfileMenuOpen(false);
                    return;
                  }
                  if (!["ArrowDown", "ArrowUp"].includes(event.key) || !canSwitchProfile) return;
                  event.preventDefault();
                  setProfileMenuOpen(true);
                  focusProfileOption(event.key === "ArrowDown" ? 0 : profiles.length - 1);
                }}
              >
                <span className="profile-switcher-copy">
                  <span className="profile-caption">Current profile</span>
                  <span className="profile-value">{activeProfile?.label ?? "Loading…"}</span>
                </span>
                <ChevronDownIcon className="profile-chevron" />
              </button>
              {profileMenuOpen && canSwitchProfile ? (
                <div
                  className="profile-menu"
                  id="profile-menu"
                  role="listbox"
                  aria-label="Profiles"
                  onKeyDown={handleProfileMenuKeyDown}
                >
                  {profiles.map((profile) => (
                    <button
                      key={profile.id}
                      type="button"
                      role="option"
                      aria-selected={profile.id === activeProfileId}
                      onClick={() => {
                        onProfileChange(profile.id);
                        setProfileMenuOpen(false);
                        setMobileMenuOpen(false);
                      }}
                    >
                      <span className="profile-option-label">{profile.label}</span>
                      {profile.id === activeProfileId ? (
                        <CheckIcon className="profile-option-check" />
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
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
