
[English](README.md) | [繁體中文](README.zh-TW.md)


<p align="center">
  <img src="apps/web/public/icon.png" height="100" style="border-radius:20px;margin:30px 0;">
  <h1 align="center">R2 Image Hosting</h1>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19.2.8-20232A?logo=react&logoColor=61DAFB" alt="React 19.2.8" />
  <img src="https://img.shields.io/badge/TypeScript-6.0.3-3178C6?logo=typescript&logoColor=white" alt="TypeScript 6.0.3" />
</p>



A small self-hosted image upload tool for blogs, documentation, and Markdown posts.

[Live Demo](https://image.demo.peiwang.dev/)

> **Note:** The demo is for showcase purposes only. Uploaded images are deleted within 7 days.


- [Features](#features)
- [Tech Stack](#tech-stack)
- [Supported Images](#supported-images)
- [Run Locally](#run-locally)
- [Configuration](#configuration)
- [Profiles](#profiles)
- [API](#api)
- [Security and Privacy](#security-and-privacy)
- [Commands](#commands)
- [CI and deployment](#ci-and-deployment)
- [Deploy](#deploy)
- [License](#license)


Drop or paste an image into the page, optimize it in the browser, upload it to Cloudflare R2, and copy the Markdown or image URL immediately.

<p align="center">
  <img src="./apps/web/public/demo.gif" alt="R2 Image Hosting upload workspace" width="500" />
</p>


## Features

- **React & TypeScript:** Client app is built by React & TypeScript.
- **Upload:** Drop one file or paste an image with `Command + V` or `Ctrl + V`.
- **Preview:** Check the image before uploading it.
- **Processing confirmation:** Compare dimensions, file sizes, resize percentage, savings, and processing time before uploading.
- **Custom processing:** Use High, Standard, Fast, or custom long-edge, WebP quality, and sharpening settings.
- **Responsive processing:** Resize, sharpen, and encode WebP in a Web Worker when supported, with a native Canvas fallback.
- **Auto rename:** Enter a display filename or generate a random eight-character name.
- **Upload result:** Show the uploaded image, Markdown, and image URL after a successful upload.
- **Profiles:** Switch between R2 buckets and use the in-app setup helper to prepare a new server-side profile without exposing bucket credentials to the browser.
- **Permanent admin key:** Protect every management API with a deployer-owned Bearer token saved from the key icon.
- **Themes:** Use the system theme or choose light/dark mode.
- **Tags:** Add tags and search images by tag.
- **Gallery and list:** Switch from the header between a full-width Masonry gallery with 30 px margins that loads more images as you scroll, or a centered list capped at 900 px for easier reading and management.
- **Edit:** Change the display filename without changing the image URL.
- **Delete:** Remove images from the library.

## Tech Stack

| Technology | Used for |
| --- | --- |
| Cloudflare Workers | Serves the website and image API |
| Cloudflare R2 | Stores uploaded images |
| TypeScript | Worker and API code |
| React, TypeScript, Vite | Browser interface |
| Vitest | Automated tests |

The browser runtime dependencies are React and ReactDOM; image processing uses native browser APIs without a separate image codec dependency.

The pnpm workspace contains only `apps/web`, `apps/gateway`, and `packages/contracts`. The Gateway Worker remains the single public entry point and deploys the Web assets and API together; Contracts contains only data, limits, and error shapes shared by those two apps.

[Image processing benchmark](docs/image-processing-benchmark.md)

## Supported Images

The app accepts JPEG, PNG, GIF, WebP, and AVIF files. The default upload limit is 10 MiB.

The server checks the real file signature instead of trusting the MIME type sent by the browser. SVG is not supported because it may contain executable scripts.

## Run Locally

Node.js 22 or newer is required.

```bash
pnpm install
cp .dev.vars.example .dev.vars
openssl rand -hex 32
cp wrangler.jsonc.example wrangler.jsonc
```

Replace `ADMIN_TOKEN` in `.dev.vars` with the generated value, then start the app:

```bash
pnpm dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173) in your browser. Vite proxies API and image requests to the local Worker on port `8787`.

Wrangler uses local R2 storage during development, so local uploads do not change the production bucket.

## Configuration

Local settings are stored in `.dev.vars`:

```dotenv
ADMIN_TOKEN=replace-with-your-generated-value
CORS_ORIGINS=http://localhost:3000,https://www.example.com
MAX_UPLOAD_BYTES=10485760
```

- `ADMIN_TOKEN` protects the management API. It does not expire automatically.
- `CORS_ORIGINS` controls which browser origins can call the API.
- `MAX_UPLOAD_BYTES` sets the upload size limit.

Profile names, bindings, and public URLs are managed together in `vars.IMAGE_PROFILES` in `wrangler.jsonc`.

On first visit, the app opens the admin-key popup automatically. Enter the same `ADMIN_TOKEN`. After verification, the key is stored in that browser's `localStorage` until you clear it from the key icon or clear the site's browser data.

For production, store it as an encrypted Worker secret rather than a Wrangler variable:

```bash
npx wrangler secret put ADMIN_TOKEN
```

Existing deployments using the former `AUTH_TOKEN` secret remain compatible, but new deployments should use `ADMIN_TOKEN`.

## Profiles

Each profile maps to one Cloudflare R2 bucket. Switching profiles keeps uploads, gallery and list views, search, and deletion separated by bucket.

1. Create an R2 bucket and enable its public URL in Cloudflare.
2. Select **+** in the app and complete the fields below.
3. Copy **R2 bucket binding** and paste it inside `r2_buckets` in `wrangler.jsonc`.
4. Copy **Profile entry** and paste it inside `vars.IMAGE_PROFILES`.
5. Restart the local Worker, or run `pnpm deploy` for production, then refresh the app.

| Field | Required | What to enter | Example |
| --- | --- | --- | --- |
| **Profile name** | Yes | The name shown in the app's profile switcher. Maximum 60 characters. | `Archive` |
| **Profile ID** | Yes | A stable 1–32 character ID using lowercase letters, numbers, and hyphens. | `archive` |
| **R2 bucket name** | Yes | The exact bucket name shown under **R2 object storage → Overview**. | `archive-images` |
| **Worker binding** | Yes | A unique JavaScript variable name used by the Worker. Uppercase letters and underscores are recommended. | `ARCHIVE_IMAGES` |
| **Public image URL** | Yes | The active URL under **Bucket → Settings → Public access**, without a trailing slash. | `https://archive-img.example.com` |

`IMAGE_PROFILES` is a normal JSON array; no escaped JSON string is needed. Keep the default profile as the entry with `"id": "default"`. Both copy fields include a trailing comma and are ready to paste directly into their matching arrays. The binding name must match exactly between `r2_buckets` and `IMAGE_PROFILES`.

## API

| Method | Route | What it does |
| --- | --- | --- |
| `GET` | `/health` | Checks whether the Worker is running |
| `GET` | `/api/auth/verify` | Verifies the saved admin key |
| `GET` | `/api/profiles` | Lists safe profile IDs and labels |
| `GET` | `/images/:key` | Returns an image |
| `GET` | `/profile-images/:profile/:key` | Returns an image from an additional profile |
| `POST` | `/api/images?profile=...` | Uploads an image |
| `GET` | `/api/images?profile=...` | Lists images and filters them by tag |
| `PATCH` | `/api/images?profile=...&key=...` | Updates the display filename or tags |
| `DELETE` | `/api/images?profile=...&key=...` | Deletes an image |

The `profile` query is optional. Omitting it uses the existing default profile.

Every `/api/*` route requires `Authorization: Bearer <ADMIN_TOKEN>`. Public image routes under `/images/*` and `/profile-images/*` do not require authentication.

## Security and Privacy

- Uploaded images are public. Random image IDs make accidental discovery less likely, but they are not access control.
- Use dedicated R2 buckets that are written only by this Worker. Public image responses reject non-image content types.
- The admin key is stored in the current browser's `localStorage` until you clear it. Use a trusted browser profile and rotate the Worker secret if the key may be exposed.
- Never commit `.dev.vars`, `.env`, `wrangler.jsonc`, or `.wrangler/`. The last directory can contain local R2 objects and metadata.
- Share the project through Git rather than archiving the entire working directory, which may include ignored local files.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Starts Vite and the local Worker |
| `pnpm dev:worker` | Starts only the local Worker |
| `pnpm build` | Builds the React production assets |
| `pnpm test` | Runs the tests |
| `pnpm lint` | Checks the code style |
| `pnpm typecheck` | Checks TypeScript types |
| `pnpm check` | Runs lint, type checking, tests, and the production build |
| `pnpm smoke` | Checks the configured production `/health` endpoint |
| `pnpm deploy` | Deploys the Worker to Cloudflare |

## CI and deployment

Pull requests and pushes to `main` install the declared pnpm version with the Node version in `.nvmrc`, use the frozen lockfile, and run `pnpm check`. After that check succeeds on `main`, the same workflow deploys the Web assets and Gateway Worker together.

Installing dependencies also initializes a Husky pre-push hook that runs the same `pnpm check`; GitHub CI remains the authoritative gate.

Configure these encrypted secrets in the GitHub `production` environment:

| Secret | Value |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | The Cloudflare account that owns the Worker |
| `CLOUDFLARE_API_TOKEN` | A token scoped to that account, using Cloudflare's **Edit Cloudflare Workers** policy |
| `CLOUDFLARE_WRANGLER_CONFIG` | The complete contents of your private `wrangler.jsonc` |

The workflow creates `wrangler.jsonc` only on its temporary runner. The personal file remains ignored by Git and pull requests never receive deployment secrets.

Also set `PRODUCTION_BASE_URL` as a plain environment variable, for example `https://your-worker.workers.dev`. After deployment, the workflow requests its `/health` endpoint with a 10-second timeout and verifies the HTTP status, service name, and health status. A failed check leaves the deployment output in the same Actions run for diagnosis.

To roll back, open **Cloudflare → Workers & Pages → your Worker → Deployments**, find the last stable version, open its menu, and select **Rollback**. You can also run `pnpm exec wrangler rollback <VERSION_ID> --config wrangler.jsonc --message "Rollback failed deployment"`. A Worker rollback does not undo changes to R2 objects or other resources.

## Deploy

1. Sign in to Cloudflare and create an R2 bucket:

   ```bash
   pnpm exec wrangler login
   pnpm exec wrangler r2 bucket create my-images
   ```

2. If you have not created a local deployment configuration yet, copy the public template:

   ```bash
   cp wrangler.jsonc.example wrangler.jsonc
   ```

   Then update these placeholders in `wrangler.jsonc`:

   - `name`
   - `r2_buckets[0].bucket_name`
   - `vars.IMAGE_PROFILES[0].label`
   - `vars.IMAGE_PROFILES[0].publicBaseUrl`
   - `vars.CORS_ORIGINS` when another browser origin needs API access

3. Connect an R2 Custom Domain and save it as the profile's `publicBaseUrl`. Use `r2.dev` only for local or temporary testing; it is rate-limited and does not provide production cache controls. Image responses are stored at the edge but revalidated before reuse, so deleting an object does not leave a fresh long-lived copy behind.

4. For the first deployment, create a unique production admin key and store it as a Worker secret:

   ```bash
   openssl rand -hex 32
   pnpm exec wrangler secret put ADMIN_TOKEN
   ```

5. Deploy:

   ```bash
   pnpm deploy
   ```

Wrangler only enforces a secret during deployment when it is listed under `secrets.required`. This template leaves that optional validation unset so existing deployments using the former `AUTH_TOKEN` remain compatible. For a new deployment, configure `ADMIN_TOKEN` once; Cloudflare keeps secrets across later `wrangler deploy` operations, so you only need to enter it again when rotating or recreating the secret. If neither token exists, the Worker still deploys but its management API rejects requests with `AUTH_NOT_CONFIGURED`. See Cloudflare's [Secrets documentation](https://developers.cloudflare.com/workers/configuration/secrets/).



## License

MIT. See [LICENSE](LICENSE).
