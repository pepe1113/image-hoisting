try {
  const stored = JSON.parse(localStorage.getItem("r2-image-settings-v1") || "null");
  if (stored?.theme) document.documentElement.dataset.theme = stored.theme;
} catch {
  // Invalid local settings fall back to the default theme.
}
