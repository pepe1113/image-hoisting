import { useRef, useState, type ChangeEvent } from "react";
import { Modal } from "../../components/Modal";
import { parseSettings } from "../../core";
import type {
  AppSettings,
  ProfilePreferences,
  ResizePreset,
  Theme,
} from "../../types";

interface SettingsDialogProps {
  settings: AppSettings;
  preferences: ProfilePreferences;
  profileLabel: string;
  onTheme: (theme: Theme) => void;
  onPreferences: (preferences: ProfilePreferences) => void;
  onImport: (settings: AppSettings) => void;
  onExport: () => void;
  onClose: () => void;
}

export function SettingsDialog({
  settings,
  preferences,
  profileLabel,
  onTheme,
  onPreferences,
  onImport,
  onExport,
  onClose,
}: SettingsDialogProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<AppSettings | null>(null);
  const [importError, setImportError] = useState("");

  function setPreset(preset: ResizePreset): void {
    const presetValues =
      preset === "large"
        ? { maxDimension: 1920, quality: 85 }
        : preset === "medium"
          ? { maxDimension: 1280, quality: 82 }
          : {};
    onPreferences({ ...preferences, ...presetValues, resizePreset: preset });
  }

  async function readImport(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = parseSettings(JSON.parse(await file.text()));
      if (!parsed) throw new Error("Invalid settings file");
      setPendingImport(parsed);
      setImportError("");
    } catch {
      setPendingImport(null);
      setImportError("This file is not a valid version 1 settings export.");
    }
  }

  return (
    <Modal title="Settings" onClose={onClose}>
      <div className="settings-grid">
        <label className="settings-field">
          <span>Theme</span>
          <select
            value={settings.theme}
            onChange={(event) => onTheme(event.target.value as Theme)}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>

        <fieldset className="settings-field settings-field-wide">
          <legend>Processing for {profileLabel}</legend>
          <div className="preset-row">
            {(["original", "large", "medium", "custom"] as const).map(
              (preset) => (
                <button
                  className={`preset-button${preferences.resizePreset === preset ? " is-active" : ""}`}
                  type="button"
                  key={preset}
                  onClick={() => setPreset(preset)}
                >
                  {preset === "original"
                    ? "Original"
                    : preset === "large"
                      ? "1920 / 85"
                      : preset === "medium"
                        ? "1280 / 82"
                        : "Custom"}
                </button>
              ),
            )}
          </div>
        </fieldset>

        <label className="settings-field">
          <span>Maximum long edge</span>
          <input
            type="number"
            min="320"
            max="8192"
            value={preferences.maxDimension}
            disabled={preferences.resizePreset !== "custom"}
            onChange={(event) =>
              onPreferences({
                ...preferences,
                maxDimension: Number(event.target.value),
              })
            }
          />
        </label>
        <label className="settings-field">
          <span>WebP quality</span>
          <input
            type="number"
            min="60"
            max="100"
            value={preferences.quality}
            disabled={preferences.resizePreset !== "custom"}
            onChange={(event) =>
              onPreferences({
                ...preferences,
                quality: Number(event.target.value),
              })
            }
          />
        </label>

        <section className="settings-transfer settings-field-wide">
          <div>
            <strong>Import or export settings</strong>
            <p>
              Includes safe interface and processing preferences. Bucket
              bindings and secrets stay on the server.
            </p>
          </div>
          <div className="settings-actions">
            <button
              className="button button-secondary"
              type="button"
              onClick={() => fileInput.current?.click()}
            >
              Import
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={onExport}
            >
              Export
            </button>
            <input
              ref={fileInput}
              className="visually-hidden"
              type="file"
              accept="application/json,.json"
              onChange={readImport}
            />
          </div>
          {importError ? <p className="inline-warning">{importError}</p> : null}
          {pendingImport ? (
            <div className="import-confirmation">
              <p>
                Apply theme “{pendingImport.theme}” and settings for{" "}
                {Object.keys(pendingImport.profiles).length} profile(s)? Unknown
                profile IDs will be ignored.
              </p>
              <div className="settings-actions">
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => setPendingImport(null)}
                >
                  Cancel
                </button>
                <button
                  className="button button-primary"
                  type="button"
                  onClick={() => {
                    onImport(pendingImport);
                    setPendingImport(null);
                  }}
                >
                  Apply import
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </Modal>
  );
}
