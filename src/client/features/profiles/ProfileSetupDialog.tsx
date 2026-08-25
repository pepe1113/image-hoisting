import { useState } from "react";
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
