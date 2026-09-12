import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://127.0.0.1:8787", changeOrigin: true },
      "/health": { target: "http://127.0.0.1:8787", changeOrigin: true },
      "/images": { target: "http://127.0.0.1:8787", changeOrigin: true },
      "/profile-images": { target: "http://127.0.0.1:8787", changeOrigin: true },
    },
  },
});
