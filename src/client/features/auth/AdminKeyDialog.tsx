import { useState, type FormEvent } from "react";
import { Modal } from "../../components/Modal";

interface AdminKeyDialogProps {
  currentToken: string;
  onSave: (token: string) => Promise<void>;
  onClear: () => void;
  onClose: () => void;
}

export function AdminKeyDialog({
  currentToken,
  onSave,
  onClear,
  onClose,
}: AdminKeyDialogProps) {
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
