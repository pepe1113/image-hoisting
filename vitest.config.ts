import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [react()],
        test: {
          name: "web",
          include: ["apps/web/test/**/*.test.{ts,tsx}"],
          environment: "jsdom",
          setupFiles: ["./apps/web/vitest.setup.ts"],
        },
      },
      {
        test: {
          name: "gateway",
          include: ["apps/gateway/test/**/*.test.ts"],
          environment: "node",
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["apps/*/src/**/*.{ts,tsx}", "packages/*/src/**/*.ts"],
      exclude: ["apps/web/src/mocks/**", "**/*.d.ts"],
      reporter: ["text", "html", "json-summary"],
    },
  },
});
