import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  deleteImage,
  fetchImages,
  fetchProfiles,
  isUnauthorized,
  updateImage,
  uploadImage,
  verifyAdminToken,
} from "./api";
import {
  clearAdminToken,
  MAX_SOURCE_BYTES,
  MAX_TAG_LENGTH,
  MAX_TAGS,
  SETTINGS_KEY,
  extensionForFile,
  formatBytes,
  formatDate,
  generatedFilename,
  imageName,
  markdownForImage,
  parseSettings,
  parseTagInput,
  profilePreferences,
  readAdminToken,
  readSettings,
  saveAdminToken,
  settingsForExport,
} from "./core";
import { prepareImage } from "./image-processing";
import type {
  AppSettings,
  GalleryView,
  ImageProfile,
  ImageRecord,
  PreparedImage,
  ProfilePreferences,
  ResizePreset,
  Theme,
} from "./types";

type Tab = "upload" | "history";

interface AdminAuthState {
  token: string;
  dialogOpen: boolean;
}

function CopyIcon(): ReactNode {
  return (
    <svg className="button-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m8 9-3 3 3 3m8-6 3 3-3 3m-3-8-2 10" />
    </svg>
  );
}

function CheckIcon(): ReactNode {
  return (
    <svg className="button-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function MenuIcon({ open }: { open: boolean }): ReactNode {
  return (
    <svg className="header-icon" viewBox="0 0 24 24" aria-hidden="true">
      {open ? (
        <path d="m6 6 12 12M18 6 6 18" />
      ) : (
        <path d="M4 7h16M4 12h16M4 17h16" />
      )}
    </svg>
  );
}

function KeyIcon(): ReactNode {
  return (
    <svg className="header-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 8-8m-3 3 2 2m-5 1 2 2" />
    </svg>
  );
}

function ProfileIcon(): ReactNode {
  return (
    <svg className="header-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7.5h14M7 4.5h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z" />
      <path d="M8 11h8m-8 4h5" />
    </svg>
  );
}

function PlusIcon(): ReactNode {
  return (
    <svg className="header-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ThemeIcon({ dark }: { dark: boolean }): ReactNode {
  return dark ? (
    <svg className="header-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4m10.6 10.6 1.4 1.4m0-13.4-1.4 1.4M6.7 17.3l-1.4 1.4" />
    </svg>
  ) : (
    <svg className="header-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 15.2A8.2 8.2 0 0 1 8.8 4a7.9 7.9 0 1 0 11.2 11.2Z" />
    </svg>
  );
}

function SettingsIcon(): ReactNode {
  return (
    <svg className="header-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </svg>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const titleId = useId();
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="modal-heading">
          <h2 id={titleId}>{title}</h2>
          <button
            className="icon-button"
            type="button"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function TagEditor({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState("");

  function commit(value = input): void {
    const next = parseTagInput([...tags, ...parseTagInput(value)].join(","));
    if (
      next.length <= MAX_TAGS &&
      next.every((tag) => tag.length <= MAX_TAG_LENGTH)
    ) {
      onChange(next);
      setInput("");
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (["Enter", ",", "，"].includes(event.key)) {
      event.preventDefault();
      commit();
    } else if (event.key === "Backspace" && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <span className="tag-editor">
      <span className="tag-badge-list">
        {tags.map((tag) => (
          <span className="tag-badge" key={tag}>
            {tag}
            <button
              type="button"
              aria-label={`Remove tag: ${tag}`}
              onClick={() => onChange(tags.filter((item) => item !== tag))}
            >
              ×
            </button>
          </span>
        ))}
      </span>
      <input
        value={input}
        onChange={(event) => {
          const value = event.target.value;
          if (/[,，]/u.test(value)) {
            const parts = value.split(/[,，]/u);
            const unfinished = parts.pop() ?? "";
            commit(parts.join(","));
            setInput(unfinished);
          } else {
            setInput(value);
          }
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => commit()}
        placeholder="Type and press Enter or comma"
      />
    </span>
  );
}

function ProcessingDialog({
  prepared,
  previewUrl,
  filename,
  onCancel,
  onUpload,
}: {
  prepared: PreparedImage;
  previewUrl: string;
  filename: string;
  onCancel: () => void;
  onUpload: (processed: boolean) => void;
}) {
  const dimensions =
    prepared.sourceWidth && prepared.sourceHeight
      ? `${prepared.sourceWidth}×${prepared.sourceHeight} → ${prepared.outputWidth}×${prepared.outputHeight}`
      : "Original dimensions preserved";
  const saving =
    prepared.savedPercent >= 0
      ? `${prepared.savedPercent}% saved`
      : `${Math.abs(prepared.savedPercent)}% larger`;

  return (
    <Modal title="Image processing preview" onClose={onCancel}>
      <div className="processing-preview">
        <img src={previewUrl} alt={`Preview of ${filename}`} />
        <div>
          <strong>{filename}</strong>
          <span>
            {formatBytes(prepared.source.size)} →{" "}
            {formatBytes(prepared.processed.size)}
          </span>
          <span>{dimensions}</span>
        </div>
        <strong
          className={
            prepared.savedPercent >= 0 ? "saving-positive" : "saving-negative"
          }
        >
          {saving}
        </strong>
      </div>
      <div className="processing-stats">
        <span>Resize</span>
        <strong>{prepared.scalePercent}%</strong>
        <span>File size</span>
        <strong>{saving}</strong>
      </div>
      {prepared.warning ? (
        <p className="inline-warning">{prepared.warning}</p>
      ) : null}
      <div className="dialog-actions">
        <button
          className="button button-secondary"
          type="button"
          onClick={onCancel}
        >
          Cancel
        </button>
        {prepared.changed && prepared.savedPercent < 0 ? (
          <>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => onUpload(true)}
            >
              Upload processed anyway
            </button>
            <button
              className="button button-primary"
              type="button"
              onClick={() => onUpload(false)}
            >
              Upload original image
            </button>
          </>
        ) : (
          <>
            {prepared.changed ? (
              <button
                className="button button-secondary"
                type="button"
                onClick={() => onUpload(false)}
              >
                Upload original
              </button>
            ) : null}
            <button
              className="button button-primary"
              type="button"
              onClick={() => onUpload(prepared.changed)}
            >
              {prepared.changed
                ? "Upload processed image"
                : "Upload original image"}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}

function SettingsDialog({
  settings,
  preferences,
  profileLabel,
  onTheme,
  onPreferences,
  onImport,
  onExport,
  onClose,
}: {
  settings: AppSettings;
  preferences: ProfilePreferences;
  profileLabel: string;
  onTheme: (theme: Theme) => void;
  onPreferences: (preferences: ProfilePreferences) => void;
  onImport: (settings: AppSettings) => void;
  onExport: () => void;
  onClose: () => void;
}) {
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

function AdminKeyDialog({
  currentToken,
  onSave,
  onClear,
  onClose,
}: {
  currentToken: string;
  onSave: (token: string) => Promise<void>;
  onClear: () => void;
  onClose: () => void;
}) {
  const [token, setToken] = useState(currentToken);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState("");

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const nextToken = token.trim();
    if (!nextToken) {
      setValidationError("Enter your admin key.");
      return;
    }
    setSaving(true);
    setValidationError("");
    try {
      await onSave(nextToken);
    } catch (error) {
      setValidationError(
        error instanceof Error
          ? error.message
          : "The admin key could not be verified.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Admin key" onClose={onClose}>
      <form onSubmit={submit}>
        <p>
          Enter the permanent key configured as the Worker secret{" "}
          <code>ADMIN_TOKEN</code>. It stays in this browser until you clear it.
        </p>
        <label className="dialog-field">
          <span>Admin key</span>
          <input
            autoFocus
            autoComplete="off"
            type="password"
            value={token}
            spellCheck={false}
            placeholder="Paste your admin key"
            onChange={(event) => setToken(event.target.value)}
          />
        </label>
        {validationError ? (
          <p className="inline-warning" role="alert">
            {validationError}
          </p>
        ) : null}
        <div className="dialog-actions admin-key-actions">
          {currentToken ? (
            <button
              className="button button-secondary clear-key-button"
              type="button"
              onClick={() => {
                setToken("");
                onClear();
              }}
            >
              Clear saved key
            </button>
          ) : null}
          <button
            className="button button-secondary"
            type="button"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="button button-primary"
            type="submit"
            disabled={saving}
          >
            {saving ? "Verifying…" : "Verify and save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ProfileSetupDialog({
  onCopy,
  onClose,
}: {
  onCopy: (value: string, message: string) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState("");
  const [id, setId] = useState("");
  const [bucketName, setBucketName] = useState("");
  const [binding, setBinding] = useState("");
  const [publicBaseUrl, setPublicBaseUrl] = useState("");

  const profile = {
    id: id.trim(),
    label: label.trim(),
    binding: binding.trim(),
    publicBaseUrl: publicBaseUrl.trim().replace(/\/$/u, ""),
  };
  const setup = [
    "R2 binding (add to r2_buckets):",
    JSON.stringify(
      { binding: profile.binding, bucket_name: bucketName.trim() },
      null,
      2,
    ),
    "",
    "Profile entry (add inside IMAGE_PROFILES):",
    JSON.stringify(profile, null, 2),
  ].join("\n");

  return (
    <Modal title="Add an R2 profile" onClose={onClose}>
      <p className="profile-setup-intro">
        Create safe deployment values for another bucket. R2 access keys never
        enter this browser.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onCopy(setup, "Profile setup copied");
        }}
      >
        <div className="profile-setup-grid">
          <label className="dialog-field">
            <span>Profile name</span>
            <input
              required
              maxLength={60}
              value={label}
              placeholder="Archive"
              onChange={(event) => setLabel(event.target.value)}
            />
          </label>
          <label className="dialog-field">
            <span>Profile ID</span>
            <input
              required
              pattern="[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?"
              value={id}
              placeholder="archive"
              onChange={(event) => setId(event.target.value)}
            />
          </label>
          <label className="dialog-field">
            <span>R2 bucket name</span>
            <input
              required
              value={bucketName}
              placeholder="archive-images"
              onChange={(event) => setBucketName(event.target.value)}
            />
          </label>
          <label className="dialog-field">
            <span>Worker binding</span>
            <input
              required
              pattern="[A-Za-z_$][A-Za-z0-9_$]*"
              value={binding}
              placeholder="ARCHIVE_IMAGES"
              onChange={(event) => setBinding(event.target.value)}
            />
          </label>
          <label className="dialog-field profile-setup-wide">
            <span>Public image URL</span>
            <input
              required
              type="url"
              value={publicBaseUrl}
              placeholder="https://archive-img.example.com"
              onChange={(event) => setPublicBaseUrl(event.target.value)}
            />
          </label>
        </div>
        <div className="profile-setup-preview">
          <strong>Deployment values</strong>
          <pre>
            <code>{setup}</code>
          </pre>
        </div>
        <p className="profile-setup-note">
          Merge both values into <code>wrangler.jsonc</code>, then redeploy. The
          new profile appears in the switcher after deployment.
        </p>
        <div className="dialog-actions">
          <button
            className="button button-secondary"
            type="button"
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="button button-primary" type="submit">
            Copy setup
          </button>
        </div>
      </form>
    </Modal>
  );
}

function UploadResult({
  image,
  onCopy,
}: {
  image: ImageRecord;
  onCopy: (value: string, message: string) => void;
}) {
  return (
    <section className="upload-result" aria-labelledby="upload-result-title">
      <div className="result-heading">
        <span className="result-kicker">UPLOAD COMPLETE</span>
        <div>
          <h2 id="upload-result-title">Your image is ready.</h2>
          <p>Choose what you want to copy.</p>
        </div>
      </div>
      <div className="result-card">
        <a
          className="result-preview"
          href={image.url}
          target="_blank"
          rel="noreferrer"
        >
          <img src={image.url} alt={image.filename} />
        </a>
        <div className="result-details">
          <div className="result-file">
            <strong>{image.filename}</strong>
            <span>
              {formatBytes(image.size)} / {formatDate(image.uploadedAt)}
            </span>
          </div>
          <div className="result-field">
            <span>Markdown</span>
            <div className="copy-field">
              <code>{markdownForImage(image)}</code>
              <button
                className="button button-secondary"
                type="button"
                onClick={() =>
                  onCopy(markdownForImage(image), "Markdown copied")
                }
              >
                Copy
              </button>
            </div>
          </div>
          <div className="result-field">
            <span>Image URL</span>
            <div className="copy-field">
              <code>{image.url}</code>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => onCopy(image.url, "Image URL copied")}
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function App() {
  const [adminAuth, setAdminAuth] = useState<AdminAuthState>(() => {
    const token = readAdminToken();
    return { token, dialogOpen: !token };
  });
  const [settings, setSettings] = useState<AppSettings>(readSettings);
  const [profiles, setProfiles] = useState<ImageProfile[]>([]);
  const [tab, setTab] = useState<Tab>("upload");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileSetupOpen, setProfileSetupOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [displayFilename, setDisplayFilename] = useState("");
  const [autoNamed, setAutoNamed] = useState(false);
  const [uploadTags, setUploadTags] = useState<string[]>([]);
  const [prepared, setPrepared] = useState<PreparedImage | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadResult, setUploadResult] = useState<ImageRecord | null>(null);
  const [notice, setNotice] = useState("");
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [refreshHistory, setRefreshHistory] = useState(0);
  const [editTarget, setEditTarget] = useState<ImageRecord | null>(null);
  const [editFilename, setEditFilename] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<ImageRecord | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [dragging, setDragging] = useState(false);

  const activeProfileId = settings.activeProfileId;
  const preferences = profilePreferences(settings, activeProfileId);
  const activeProfile =
    profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0];
  const previewUrl = useMemo(
    () => (selectedFile ? URL.createObjectURL(selectedFile) : ""),
    [selectedFile],
  );
  const selectedImages = images.filter((image) => selectedKeys.has(image.key));
  const allImagesSelected =
    images.length > 0 && selectedImages.length === images.length;

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  useEffect(() => {
    if (!adminAuth.token) return;
    const controller = new AbortController();
    fetchProfiles(adminAuth.token, controller.signal)
      .then((available) => {
        setProfiles(available);
        setSettings((current) => {
          if (
            available.length === 0 ||
            available.some((profile) => profile.id === current.activeProfileId)
          ) {
            return current;
          }
          const fallback =
            available.find((profile) => profile.isDefault) ?? available[0]!;
          return { ...current, activeProfileId: fallback.id };
        });
      })
      .catch((error: Error) => {
        if (error.name === "AbortError") return;
        if (isUnauthorized(error)) {
          clearAdminToken();
          setAdminAuth({ token: "", dialogOpen: true });
          setProfiles([]);
        }
        setNotice(error.message);
      });
    return () => controller.abort();
  }, [adminAuth.token]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    document.documentElement.dataset.theme = settings.theme;
  }, [settings]);

  useEffect(() => {
    if (tab !== "history" || !activeProfileId || !adminAuth.token) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setHistoryLoading(true);
      fetchImages(
        adminAuth.token,
        activeProfileId,
        search,
        null,
        controller.signal,
      )
        .then((payload) => {
          setImages(payload.data);
          setCursor(payload.pagination.cursor);
          setNotice("");
        })
        .catch((error: Error) => {
          if (error.name === "AbortError") return;
          setNotice(
            requestErrorMessage(error, "Could not load image history."),
          );
        })
        .finally(() => setHistoryLoading(false));
    }, 200);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [tab, activeProfileId, search, refreshHistory, adminAuth.token]);

  useEffect(() => {
    function onPaste(event: ClipboardEvent): void {
      const file = Array.from(event.clipboardData?.files ?? []).find((item) =>
        item.type.startsWith("image/"),
      );
      if (!file) return;
      event.preventDefault();
      selectFile(file);
      setToast("Image pasted and ready to upload");
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function setActiveProfile(profileId: string): void {
    setSettings((current) => ({ ...current, activeProfileId: profileId }));
    setImages([]);
    setCursor(null);
    setSearch("");
    setUploadResult(null);
    setNotice("");
    setEditTarget(null);
    setDeleteTarget(null);
    setSelectionMode(false);
    setSelectedKeys(new Set());
    setBatchDeleteOpen(false);
    setMobileMenuOpen(false);
    clearSelection();
  }

  function navigateTo(nextTab: Tab): void {
    setTab(nextTab);
    setMobileMenuOpen(false);
  }

  function requestErrorMessage(error: unknown, fallback: string): string {
    if (isUnauthorized(error)) {
      clearAdminToken();
      setAdminAuth({ token: "", dialogOpen: true });
      setProfiles([]);
      setImages([]);
      setCursor(null);
      return "The saved admin key is invalid. Enter the current key to continue.";
    }
    return error instanceof Error ? error.message : fallback;
  }

  async function saveAdminKey(token: string): Promise<void> {
    await verifyAdminToken(token);
    saveAdminToken(token);
    setAdminAuth({ token, dialogOpen: false });
    setNotice("");
    setToast("Admin key verified and saved");
  }

  function removeAdminKey(): void {
    clearAdminToken();
    setAdminAuth({ token: "", dialogOpen: true });
    setProfiles([]);
    setImages([]);
    setCursor(null);
    setNotice("");
  }

  function updatePreferences(next: ProfilePreferences): void {
    const sanitized = {
      ...next,
      maxDimension: Math.min(
        8192,
        Math.max(320, Math.round(next.maxDimension || 320)),
      ),
      quality: Math.min(100, Math.max(60, Math.round(next.quality || 60))),
    };
    setSettings((current) => ({
      ...current,
      profiles: { ...current.profiles, [activeProfileId]: sanitized },
    }));
  }

  function selectFile(file: File): void {
    if (file.size > MAX_SOURCE_BYTES) {
      setNotice("The source image cannot exceed 40 MiB.");
      return;
    }
    setSelectedFile(file);
    setDisplayFilename("");
    setAutoNamed(false);
    setUploadTags([]);
    setPrepared(null);
    setProgress(null);
    setNotice("");
  }

  function clearSelection(): void {
    setSelectedFile(null);
    setDisplayFilename("");
    setAutoNamed(false);
    setUploadTags([]);
    setPrepared(null);
    setProgress(null);
  }

  function generateName(): string {
    if (!selectedFile) return "";
    const extension =
      preferences.resizePreset === "original" ||
      selectedFile.type === "image/gif"
        ? extensionForFile(selectedFile)
        : "webp";
    const name = generatedFilename(extension);
    setDisplayFilename(name);
    setAutoNamed(true);
    return name;
  }

  async function handlePrepare(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!selectedFile) return;
    setPreparing(true);
    setNotice("");
    if (!displayFilename.trim()) generateName();
    try {
      setPrepared(await prepareImage(selectedFile, preferences));
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Image processing failed.",
      );
    } finally {
      setPreparing(false);
    }
  }

  async function startUpload(useProcessed: boolean): Promise<void> {
    if (!prepared) return;
    const file = useProcessed ? prepared.processed : prepared.source;
    let filename = displayFilename.trim();
    if (!filename) filename = generateName();
    if (autoNamed)
      filename = filename.replace(/\.[^.]*$/u, `.${extensionForFile(file)}`);
    setDisplayFilename(filename);
    setPrepared(null);
    setProgress(0);
    try {
      const image = await uploadImage(
        adminAuth.token,
        activeProfileId,
        file,
        filename,
        uploadTags,
        setProgress,
      );
      setProgress(100);
      setUploadResult(image);
      setToast(`${image.filename} uploaded and ready to copy.`);
      clearSelection();
      setRefreshHistory((value) => value + 1);
    } catch (error) {
      setNotice(requestErrorMessage(error, "Upload failed."));
      setProgress(null);
    }
  }

  async function copyText(value: string, message: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setToast(message);
    } catch {
      setNotice(
        "Clipboard access failed. Please select and copy the text manually.",
      );
    }
  }

  async function loadMore(): Promise<void> {
    if (!cursor) return;
    setHistoryLoading(true);
    try {
      const payload = await fetchImages(
        adminAuth.token,
        activeProfileId,
        search,
        cursor,
      );
      setImages((current) => [...current, ...payload.data]);
      setCursor(payload.pagination.cursor);
    } catch (error) {
      setNotice(requestErrorMessage(error, "Could not load more images."));
    } finally {
      setHistoryLoading(false);
    }
  }

  async function saveEdit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!editTarget) return;
    try {
      const updated = await updateImage(
        adminAuth.token,
        activeProfileId,
        editTarget.key,
        editFilename,
        editTags,
      );
      setImages((current) =>
        current.map((image) => (image.key === updated.key ? updated : image)),
      );
      setEditTarget(null);
      setToast("Image details updated");
    } catch (error) {
      setNotice(requestErrorMessage(error, "Update failed."));
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!deleteTarget) return;
    try {
      await deleteImage(adminAuth.token, activeProfileId, deleteTarget.key);
      setImages((current) =>
        current.filter((image) => image.key !== deleteTarget.key),
      );
      setSelectedKeys((current) => {
        const next = new Set(current);
        next.delete(deleteTarget.key);
        return next;
      });
      setDeleteTarget(null);
      setToast("Image deleted");
    } catch (error) {
      setNotice(requestErrorMessage(error, "Delete failed."));
    }
  }

  function toggleImageSelection(key: string): void {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function beginSelection(): void {
    setSelectedKeys(new Set());
    setSelectionMode(true);
  }

  function cancelSelection(): void {
    setSelectedKeys(new Set());
    setSelectionMode(false);
    setBatchDeleteOpen(false);
  }

  function toggleSelectAll(): void {
    setSelectedKeys(
      allImagesSelected ? new Set() : new Set(images.map((image) => image.key)),
    );
  }

  function copySelectedMarkdown(): void {
    if (selectedImages.length === 0) return;
    const markdown = selectedImages.map(markdownForImage).join("\n");
    void copyText(markdown, `${selectedImages.length} Markdown links copied`);
  }

  async function confirmBatchDelete(): Promise<void> {
    if (selectedImages.length === 0) return;
    const targets = selectedImages;
    setBatchDeleting(true);
    const results = await Promise.allSettled(
      targets.map((image) =>
        deleteImage(adminAuth.token, activeProfileId, image.key),
      ),
    );
    const deletedKeys = new Set(
      targets.flatMap((image, index) =>
        results[index]?.status === "fulfilled" ? [image.key] : [],
      ),
    );
    const failed = results.filter((result) => result.status === "rejected");

    if (deletedKeys.size > 0) {
      setImages((current) =>
        current.filter((image) => !deletedKeys.has(image.key)),
      );
      setSelectedKeys((current) => {
        const next = new Set(current);
        for (const key of deletedKeys) next.delete(key);
        return next;
      });
    }

    if (failed.length === 0) {
      setToast(`${deletedKeys.size} images deleted`);
      setNotice("");
      setSelectionMode(false);
    } else {
      const firstError = failed[0]?.reason;
      const detail = requestErrorMessage(firstError, "Batch delete failed.");
      setNotice(
        `${deletedKeys.size} deleted; ${failed.length} failed. ${detail}`,
      );
    }
    setBatchDeleting(false);
    setBatchDeleteOpen(false);
  }

  function exportSettings(): void {
    const url = URL.createObjectURL(
      new Blob([settingsForExport(settings)], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "r2-image-settings.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function importSettings(imported: AppSettings): void {
    const known = new Set(profiles.map((profile) => profile.id));
    const importedProfiles = Object.fromEntries(
      Object.entries(imported.profiles).filter(([id]) => known.has(id)),
    );
    setSettings({
      ...imported,
      activeProfileId: known.has(imported.activeProfileId)
        ? imported.activeProfileId
        : activeProfileId,
      profiles: importedProfiles,
    });
    setToast("Settings imported");
  }

  function setView(view: GalleryView): void {
    updatePreferences({ ...preferences, view });
  }

  const resolvedDark =
    settings.theme === "dark" ||
    (settings.theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  const canSwitchProfile = profiles.length > 1;

  return (
    <main className="app-shell" id="main-content">
      <header className="app-header">
        <a className="brand" href="/" aria-label="Image Hosting home">
          <span className="brand-mark" aria-hidden="true">
            ⤴︎
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
              onClick={() => navigateTo("upload")}
            >
              Upload
            </button>
            <button
              type="button"
              aria-current={tab === "history" ? "page" : undefined}
              onClick={() => navigateTo("history")}
            >
              History
            </button>
          </nav>
          <div className="header-actions">
            <div className="profile-control">
              <label
                className={`profile-switcher${canSwitchProfile ? "" : " is-disabled"}`}
              >
                <span className="profile-icon">{ProfileIcon()}</span>
                <span className="profile-switcher-copy">
                  <span className="profile-caption">Current profile</span>
                  <select
                    value={activeProfileId}
                    onChange={(event) => setActiveProfile(event.target.value)}
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
                onClick={() => {
                  setProfileSetupOpen(true);
                  setMobileMenuOpen(false);
                }}
              >
                {PlusIcon()}
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
                onClick={() => {
                  setSettings((current) => ({
                    ...current,
                    theme: resolvedDark ? "light" : "dark",
                  }));
                  setMobileMenuOpen(false);
                }}
              >
                {ThemeIcon({ dark: resolvedDark })}
              </button>
              <button
                className="icon-button utility-button"
                type="button"
                title="Open settings"
                aria-label="Open settings"
                onClick={() => {
                  setSettingsOpen(true);
                  setMobileMenuOpen(false);
                }}
              >
                {SettingsIcon()}
              </button>
              <button
                className={`icon-button key-button utility-button${adminAuth.token ? " is-authenticated" : ""}`}
                type="button"
                title={adminAuth.token ? "Admin key saved" : "Set admin key"}
                aria-label={
                  adminAuth.token ? "Manage admin key" : "Set admin key"
                }
                onClick={() => {
                  setAdminAuth((current) => ({ ...current, dialogOpen: true }));
                  setMobileMenuOpen(false);
                }}
              >
                {KeyIcon()}
              </button>
            </div>
          </div>
        </div>
      </header>

      <section className="workspace-heading" aria-labelledby="page-title">
        <mark className="eyebrow">PERSONAL IMAGE TOOL</mark>
        <h1 id="page-title">Upload images.</h1>
        <p>
          Drop, paste, resize, and upload to{" "}
          {activeProfile?.label ?? "your R2 bucket"}.
        </p>
      </section>

      {notice ? (
        <div className="notice" role="alert">
          {notice}
        </div>
      ) : null}

      {tab === "upload" ? (
        <section
          className="upload-section tab-panel"
          aria-label="Upload images"
        >
          <form onSubmit={handlePrepare}>
            <input
              id="file-input"
              className="visually-hidden"
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) selectFile(file);
                event.target.value = "";
              }}
            />
            {!selectedFile ? (
              <label
                className={`drop-zone${dragging ? " is-dragging" : ""}`}
                htmlFor="file-input"
                tabIndex={0}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  const file = event.dataTransfer.files[0];
                  if (file) selectFile(file);
                }}
              >
                <span className="drop-blob" aria-hidden="true" />
                <span className="drop-copy">
                  <span className="drop-kicker">DROP IT HERE</span>
                  <strong>Drop or paste an image</strong>
                  <span>
                    Click to browse or press <kbd>⌘V</kbd> / <kbd>Ctrl+V</kbd>
                  </span>
                  <small>JPG, PNG, GIF, WebP, AVIF</small>
                </span>
              </label>
            ) : (
              <div className="selected-file selected-file-expanded">
                <img
                  src={previewUrl}
                  alt="Preview of the image ready to upload"
                />
                <div className="selected-copy">
                  <strong>{selectedFile.name}</strong>
                  <span>
                    {formatBytes(selectedFile.size)} / {selectedFile.type}
                  </span>
                </div>
                <div className="selected-actions">
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={clearSelection}
                  >
                    Remove
                  </button>
                  <button
                    className="button button-primary"
                    type="submit"
                    disabled={preparing}
                  >
                    {preparing ? "Processing…" : "Review upload"}
                  </button>
                </div>
                <label className="upload-filename">
                  <span>Display filename</span>
                  <span className="filename-row">
                    <input
                      value={displayFilename}
                      maxLength={180}
                      placeholder="Leave blank to auto rename"
                      onChange={(event) => {
                        setDisplayFilename(event.target.value);
                        setAutoNamed(false);
                      }}
                    />
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={generateName}
                    >
                      Generate
                    </button>
                  </span>
                </label>
                <label className="upload-tags">
                  <span>Tags (optional)</span>
                  <TagEditor tags={uploadTags} onChange={setUploadTags} />
                </label>
                <div className="processing-summary">
                  <span>
                    {preferences.resizePreset === "original"
                      ? "Original image"
                      : `Max ${preferences.maxDimension}px · WebP ${preferences.quality}%`}
                  </span>
                  <button type="button" onClick={() => setSettingsOpen(true)}>
                    Change
                  </button>
                </div>
              </div>
            )}
            {progress !== null ? (
              <div className="upload-progress">
                <div className="progress-copy">
                  <span>
                    {progress < 100 ? "Uploading" : "Upload complete"}
                  </span>
                  <strong>{progress}%</strong>
                </div>
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                >
                  <span style={{ transform: `scaleX(${progress / 100})` }} />
                </div>
              </div>
            ) : null}
            {uploadResult ? (
              <UploadResult image={uploadResult} onCopy={copyText} />
            ) : null}
          </form>
        </section>
      ) : (
        <section
          className="library-section tab-panel"
          aria-label="Image history"
        >
          <div className="library-toolbar">
            <div className="section-heading">
              <h2>Image history</h2>
              <p>Images stored in {activeProfile?.label ?? "this profile"}.</p>
            </div>
            <div className="library-controls">
              <label className="search-field">
                <span className="visually-hidden">Search tags</span>
                <input
                  type="search"
                  value={search}
                  placeholder="Search tags (comma-separated)"
                  onChange={(event) => {
                    setSearch(event.target.value);
                    cancelSelection();
                  }}
                />
              </label>
              <div
                className="view-switcher"
                aria-label="Image view"
                data-view={preferences.view}
              >
                <button
                  className={`view-button${preferences.view === "grid" ? " is-active" : ""}`}
                  type="button"
                  aria-label="Grid view"
                  aria-pressed={preferences.view === "grid"}
                  onClick={() => setView("grid")}
                >
                  ▦
                </button>
                <button
                  className={`view-button${preferences.view === "list" ? " is-active" : ""}`}
                  type="button"
                  aria-label="List view"
                  aria-pressed={preferences.view === "list"}
                  onClick={() => setView("list")}
                >
                  ☷
                </button>
              </div>
              {images.length > 0 ? (
                <button
                  className="button button-secondary selection-mode-button"
                  type="button"
                  aria-pressed={selectionMode}
                  onClick={selectionMode ? cancelSelection : beginSelection}
                >
                  {selectionMode ? "Cancel" : "Select"}
                </button>
              ) : null}
            </div>
          </div>
          {historyLoading && images.length === 0 ? (
            <div className="gallery skeleton-grid">
              {Array.from({ length: 4 }, (_, index) => (
                <div className="skeleton" key={index} />
              ))}
            </div>
          ) : null}
          {!historyLoading && images.length === 0 ? (
            <div className="empty-state">
              <h3>{search ? "No matching images" : "Your history is empty"}</h3>
              <p>
                {search
                  ? "Try another tag."
                  : "Choose Upload in the navigation to add your first image."}
              </p>
            </div>
          ) : null}
          {selectionMode ? (
            <div className="batch-toolbar" aria-label="Batch actions">
              <div className="selection-summary">
                <span aria-live="polite">{selectedImages.length} selected</span>
              </div>
              <div className="batch-actions">
                <button
                  className="button button-secondary"
                  type="button"
                  aria-pressed={allImagesSelected}
                  onClick={toggleSelectAll}
                >
                  {allImagesSelected ? "Clear all" : "Select all"}
                </button>
                {selectedImages.length > 0 ? (
                  <>
                    <button
                      className="button button-primary"
                      type="button"
                      aria-label="Copy selected Markdown"
                      onClick={copySelectedMarkdown}
                    >
                      {CopyIcon()}Copy Markdown
                    </button>
                    <button
                      className="button button-danger"
                      type="button"
                      aria-label="Delete selected"
                      onClick={() => setBatchDeleteOpen(true)}
                    >
                      Delete
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
          <div
            className="gallery"
            data-view={preferences.view}
            data-selecting={selectionMode || undefined}
          >
            {images.map((image) => (
              <article
                className="image-row"
                data-selected={selectedKeys.has(image.key) || undefined}
                key={`${image.profileId}:${image.key}`}
              >
                {selectionMode ? (
                  <button
                    className="selection-toggle"
                    type="button"
                    aria-label={`${selectedKeys.has(image.key) ? "Deselect" : "Select"} ${image.filename}`}
                    aria-pressed={selectedKeys.has(image.key)}
                    onClick={() => toggleImageSelection(image.key)}
                  >
                    {selectedKeys.has(image.key) ? CheckIcon() : null}
                  </button>
                ) : null}
                <button
                  className="image-frame"
                  type="button"
                  aria-label={`Copy image URL for ${image.filename}`}
                  onClick={() => copyText(image.url, "Image URL copied")}
                >
                  <img src={image.url} alt={image.filename} loading="lazy" />
                </button>
                <div className="image-info">
                  <strong className="image-name" title={imageName(image)}>
                    {imageName(image)}
                  </strong>
                  <p className="image-meta">
                    {formatBytes(image.size)} / {formatDate(image.uploadedAt)}
                  </p>
                  <div className="image-tags">
                    {image.tags.length ? (
                      image.tags.map((tag) => (
                        <button
                          type="button"
                          key={tag}
                          onClick={() => {
                            setSearch(tag);
                            cancelSelection();
                          }}
                        >
                          {tag}
                        </button>
                      ))
                    ) : (
                      <span className="no-tags">No tags</span>
                    )}
                  </div>
                  <button
                    className="url-copy"
                    type="button"
                    title={image.url}
                    onClick={() => copyText(image.url, "Image URL copied")}
                  >
                    {image.url}
                  </button>
                </div>
                <div className="image-actions">
                  <button
                    className="button button-primary copy-action"
                    type="button"
                    onClick={() =>
                      copyText(markdownForImage(image), "Markdown copied")
                    }
                  >
                    {CopyIcon()}
                    <span className="button-label">Copy Markdown</span>
                  </button>
                  <button
                    className="button button-secondary icon-action"
                    type="button"
                    onClick={() => {
                      setEditTarget(image);
                      setEditFilename(image.filename);
                      setEditTags(image.tags);
                    }}
                  >
                    <span className="button-label">Edit</span>
                  </button>
                  <button
                    className="button button-secondary icon-action"
                    type="button"
                    onClick={() => setDeleteTarget(image)}
                  >
                    <span className="button-label">Delete</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
          {cursor ? (
            <div className="load-more-row">
              <button
                className="button button-secondary"
                type="button"
                disabled={historyLoading}
                onClick={loadMore}
              >
                Load more
              </button>
            </div>
          ) : null}
        </section>
      )}

      <footer className="app-footer">
        <span>Self-hosted image workspace</span>
        <span>Cloudflare R2 + React</span>
      </footer>

      {prepared ? (
        <ProcessingDialog
          prepared={prepared}
          previewUrl={previewUrl}
          filename={displayFilename}
          onCancel={() => setPrepared(null)}
          onUpload={startUpload}
        />
      ) : null}
      {adminAuth.dialogOpen ? (
        <AdminKeyDialog
          currentToken={adminAuth.token}
          onSave={saveAdminKey}
          onClear={removeAdminKey}
          onClose={() =>
            setAdminAuth((current) => ({ ...current, dialogOpen: false }))
          }
        />
      ) : null}
      {profileSetupOpen ? (
        <ProfileSetupDialog
          onCopy={copyText}
          onClose={() => setProfileSetupOpen(false)}
        />
      ) : null}
      {settingsOpen ? (
        <SettingsDialog
          settings={settings}
          preferences={preferences}
          profileLabel={activeProfile?.label ?? "Default"}
          onTheme={(theme) => setSettings((current) => ({ ...current, theme }))}
          onPreferences={updatePreferences}
          onImport={importSettings}
          onExport={exportSettings}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
      {editTarget ? (
        <Modal title="Edit image details" onClose={() => setEditTarget(null)}>
          <form onSubmit={saveEdit}>
            <label className="dialog-field">
              <span>Filename</span>
              <input
                value={editFilename}
                required
                maxLength={180}
                onChange={(event) => setEditFilename(event.target.value)}
              />
            </label>
            <label className="dialog-field">
              <span>Tags</span>
              <TagEditor tags={editTags} onChange={setEditTags} />
            </label>
            <div className="dialog-actions">
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setEditTarget(null)}
              >
                Cancel
              </button>
              <button className="button button-primary" type="submit">
                Save
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
      {deleteTarget ? (
        <Modal title="Delete this image?" onClose={() => setDeleteTarget(null)}>
          <p>
            The image will be permanently removed from{" "}
            {activeProfile?.label ?? "R2"} and its public URL will stop working.
          </p>
          <strong>{deleteTarget.filename}</strong>
          <div className="dialog-actions">
            <button
              className="button button-secondary"
              type="button"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </button>
            <button
              className="button button-danger"
              type="button"
              onClick={confirmDelete}
            >
              Delete image
            </button>
          </div>
        </Modal>
      ) : null}
      {batchDeleteOpen ? (
        <Modal
          title={`Delete ${selectedImages.length} images?`}
          onClose={() => {
            if (!batchDeleting) setBatchDeleteOpen(false);
          }}
        >
          <p>
            The selected images will be permanently removed from{" "}
            {activeProfile?.label ?? "R2"}. Their public URLs will stop working.
          </p>
          <strong>
            {selectedImages.map((image) => image.filename).join(", ")}
          </strong>
          <div className="dialog-actions">
            <button
              className="button button-secondary"
              type="button"
              disabled={batchDeleting}
              onClick={() => setBatchDeleteOpen(false)}
            >
              Cancel
            </button>
            <button
              className="button button-danger"
              type="button"
              disabled={batchDeleting}
              onClick={confirmBatchDelete}
            >
              {batchDeleting
                ? "Deleting…"
                : `Delete ${selectedImages.length} images`}
            </button>
          </div>
        </Modal>
      ) : null}
      {toast ? (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      ) : null}
    </main>
  );
}
