import { useEffect, useState } from "react";

export function useNotifications() {
  const [notice, setNotice] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

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

  return { notice, setNotice, toast, setToast, copyText };
}
