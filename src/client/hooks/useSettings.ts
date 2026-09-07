import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import {
  SETTINGS_KEY,
  profilePreferences,
  readSettings,
} from "../core";
import type {
  AppSettings,
  ImageProfile,
  ProfilePreferences,
  Theme,
} from "../types";

const DARK_MODE_QUERY = "(prefers-color-scheme: dark)";

function subscribeToSystemTheme(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_MODE_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function systemThemeIsDark(): boolean {
  return window.matchMedia(DARK_MODE_QUERY).matches;
}

function serverThemeIsDark(): boolean {
  return false;
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(readSettings);
  const systemDark = useSyncExternalStore(
    subscribeToSystemTheme,
    systemThemeIsDark,
    serverThemeIsDark,
  );
  const activeProfileId = settings.activeProfileId;
  const preferences = profilePreferences(settings, activeProfileId);
  const resolvedDark =
    settings.theme === "dark" ||
    (settings.theme === "system" && systemDark);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    document.documentElement.dataset.theme = settings.theme;
  }, [settings]);

  function setTheme(theme: Theme): void {
    setSettings((current) => ({ ...current, theme }));
  }

  const setActiveProfileId = useCallback((profileId: string): void => {
    setSettings((current) => ({ ...current, activeProfileId: profileId }));
  }, []);

  const reconcileProfiles = useCallback((profiles: ImageProfile[]): void => {
    setSettings((current) => {
      if (
        profiles.length === 0 ||
        profiles.some((profile) => profile.id === current.activeProfileId)
      ) {
        return current;
      }
      const fallback =
        profiles.find((profile) => profile.isDefault) ?? profiles[0]!;
      return { ...current, activeProfileId: fallback.id };
    });
  }, []);

  function updatePreferences(next: ProfilePreferences): void {
    const sanitized = {
      ...next,
      maxDimension: Math.min(
        8192,
        Math.max(320, Math.round(next.maxDimension || 320)),
      ),
      quality: Math.min(100, Math.max(10, Math.round(next.quality || 10))),
    };
    setSettings((current) => ({
      ...current,
      profiles: { ...current.profiles, [activeProfileId]: sanitized },
    }));
  }

  return {
    activeProfileId,
    preferences,
    resolvedDark,
    setTheme,
    setActiveProfileId,
    reconcileProfiles,
    updatePreferences,
  };
}
