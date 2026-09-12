import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["coverage", "**/dist", "node_modules", "**/.wrangler"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      globals: {
        Blob: "readonly",
        File: "readonly",
        FormData: "readonly",
        Headers: "readonly",
        Request: "readonly",
        Response: "readonly",
        TextEncoder: "readonly",
        URL: "readonly",
        crypto: "readonly",
        document: "readonly",
        localStorage: "readonly",
        navigator: "readonly",
        window: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    files: ["**/public/**/*.js"],
    languageOptions: {
      globals: {
        FormData: "readonly",
        Headers: "readonly",
        File: "readonly",
        Intl: "readonly",
        localStorage: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        XMLHttpRequest: "readonly",
        createImageBitmap: "readonly",
        document: "readonly",
        fetch: "readonly",
        navigator: "readonly",
        sessionStorage: "readonly",
        window: "readonly",
      },
    },
  },
);
