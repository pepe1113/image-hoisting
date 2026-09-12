import { useState } from "react";
import { CopyIcon } from "../../components/icons";
import { Modal } from "../../components/Modal";

interface ProfileSetupDialogProps {
  onCopy: (value: string, message: string) => void;
  onClose: () => void;
}

export function ProfileSetupDialog({
  onCopy,
  onClose,
}: ProfileSetupDialogProps) {
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
  const bucketBinding = `${JSON.stringify(
    { binding: profile.binding, bucket_name: bucketName.trim() },
    null,
    2,
  )},`;
  const profileEntry = `${JSON.stringify(profile, null, 2)},`;

  return (
    <Modal title="Add an R2 profile" onClose={onClose}>
      <p className="profile-setup-intro">
        Create safe deployment values for another bucket. R2 access keys never
        enter this browser.
      </p>
      <form onSubmit={(event) => event.preventDefault()}>
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
        <div className="profile-setup-values">
          <div className="profile-setup-preview">
            <div className="profile-setup-preview-heading">
              <span>
                <strong>R2 bucket binding</strong>
                <small>Paste inside r2_buckets</small>
              </span>
              <button
                className="icon-button profile-setup-copy"
                type="button"
                title="Copy R2 bucket binding"
                aria-label="Copy R2 bucket binding"
                onClick={(event) => {
                  if (!event.currentTarget.form?.reportValidity()) return;
                  onCopy(bucketBinding, "R2 bucket binding copied");
                }}
              >
                <CopyIcon />
              </button>
            </div>
            <pre>
              <code>{bucketBinding}</code>
            </pre>
          </div>
          <div className="profile-setup-preview">
            <div className="profile-setup-preview-heading">
              <span>
                <strong>Profile entry</strong>
                <small>Paste inside IMAGE_PROFILES</small>
              </span>
              <button
                className="icon-button profile-setup-copy"
                type="button"
                title="Copy profile entry"
                aria-label="Copy profile entry"
                onClick={(event) => {
                  if (!event.currentTarget.form?.reportValidity()) return;
                  onCopy(profileEntry, "Profile entry copied");
                }}
              >
                <CopyIcon />
              </button>
            </div>
            <pre>
              <code>{profileEntry}</code>
            </pre>
          </div>
        </div>
        <p className="profile-setup-note">
          Both values include a trailing comma and can be pasted directly into
          the matching arrays in <code>wrangler.jsonc</code>.
        </p>
        <div className="dialog-actions">
          <button
            className="button button-primary"
            type="button"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </form>
    </Modal>
  );
}
