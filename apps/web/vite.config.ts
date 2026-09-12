import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const uploadSourceMaps = Boolean(
    env.SENTRY_AUTH_TOKEN && env.SENTRY_ORG && env.SENTRY_PROJECT && env.SENTRY_RELEASE,
  );

  return {
    plugins: [
      react(),
      uploadSourceMaps &&
        sentryVitePlugin({
          authToken: env.SENTRY_AUTH_TOKEN!,
          org: env.SENTRY_ORG!,
          project: env.SENTRY_PROJECT!,
          release: { name: env.SENTRY_RELEASE! },
          sourcemaps: { filesToDeleteAfterUpload: ["./dist/**/*.map"] },
          telemetry: false,
          errorHandler(error) {
            throw error;
          },
        }),
    ],
    build: {
      outDir: "dist",
      emptyOutDir: true,
      sourcemap: uploadSourceMaps ? "hidden" : false,
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
  };
});
