
# R2 Image Hosting

A small self-hosted image upload tool for blogs, documentation, and Markdown posts.

<p>
  <img src="https://img.shields.io/badge/React-19.2.8-20232A?logo=react&logoColor=61DAFB" alt="React 19.2.8" />
  <img src="https://img.shields.io/badge/TypeScript-6.0.3-3178C6?logo=typescript&logoColor=white" alt="TypeScript 6.0.3" />
</p>

<p align="center">
  <img src="./bettershot_1787586046116.gif" alt="R2 Image Hosting upload workspace" width="700" />
</p>

- [R2 Image Hosting](#r2-image-hosting)
  - [Features](#features)
  - [Tech Stack](#tech-stack)
  - [Supported Images](#supported-images)
  - [Run Locally](#run-locally)
  - [Configuration](#configuration)
  - [Profiles](#profiles)
    - [What Add profile does](#what-add-profile-does)
    - [Cloudflare setup](#cloudflare-setup)
    - [Profile fields](#profile-fields)
    - [Complete example](#complete-example)
  - [API](#api)
  - [Security and Privacy](#security-and-privacy)
  - [Commands](#commands)
  - [Deploy Your Own Instance](#deploy-your-own-instance)
  - [Keep a Private Deployment Config](#keep-a-private-deployment-config)
  - [License](#license)


Drop or paste an image into the page, optimize it in the browser, upload it to Cloudflare R2, and copy the Markdown or image URL immediately.

## Features

- **React workspace:** Switch between upload and history from the header navigation without leaving the page.
- **Upload:** Drop one file or paste an image with `Command + V` or `Ctrl + V`.
- **Preview:** Check the image before uploading it.
- **Processing confirmation:** Compare dimensions, file sizes, resize percentage, and savings before choosing the original or processed image.
- **Custom processing:** Use the original, 1920px/85%, 1280px/82%, or a custom long edge and WebP quality.
- **GIF support:** Keep animated GIFs in their original format.
- **Auto rename:** Enter a display filename or generate a random eight-character name.
- **Upload result:** Show the uploaded image, Markdown, and image URL after a successful upload.
- **Quick copy:** Copy Markdown or the image URL with one click.
- **Profiles:** Switch between R2 buckets and use the in-app setup helper to prepare a new server-side profile without exposing bucket credentials to the browser.
- **Permanent admin key:** Protect every management API with a deployer-owned Bearer token saved from the key icon.
- **Themes:** Use the system theme or choose light/dark mode.
- **Settings transfer:** Export and import safe interface and processing preferences as JSON.
- **Tags:** Add tags and search images by tag.
- **Edit:** Change the display filename without changing the image URL.
- **Views:** Switch between grid and list views.
- **Delete:** Remove images from the library.
- **Short URLs:** Create a short 8-character URL for each image.

## Tech Stack

| Technology | Used for |
| --- | --- |
| Cloudflare Workers | Serves the website and image API |
| Cloudflare R2 | Stores uploaded images |
| TypeScript | Worker and API code |
| React, TypeScript, Vite | Browser interface |
| Vitest | Automated tests |

The browser runtime dependencies are React and ReactDOM; image processing still uses native browser APIs.

## Supported Images

The app accepts JPEG, PNG, GIF, WebP, and AVIF files. The default upload limit is 10 MiB.

The server checks the real file signature instead of trusting the MIME type sent by the browser. SVG is not supported because it may contain executable scripts.

## Run Locally

Node.js 22 or newer is required.

```bash
npm install
cp .dev.vars.example .dev.vars
openssl rand -hex 32
cp wrangler.jsonc.example wrangler.jsonc
```

Replace `ADMIN_TOKEN` in `.dev.vars` with the generated value, then start the app:

```bash
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173) in your browser. Vite proxies API and image requests to the local Worker on port `8787`.

Wrangler uses local R2 storage during development, so local uploads do not change the production bucket.

## Configuration

Local settings are stored in `.dev.vars`:

```dotenv
ADMIN_TOKEN=replace-with-your-generated-value
PUBLIC_BASE_URL=https://img.example.com
CORS_ORIGINS=http://localhost:3000,https://www.example.com
MAX_UPLOAD_BYTES=10485760
```

- `ADMIN_TOKEN` protects the management API. It does not expire automatically.
- `PUBLIC_BASE_URL` is used to build the returned image URL.
- `CORS_ORIGINS` controls which browser origins can call the API.
- `MAX_UPLOAD_BYTES` sets the upload size limit.

The default R2 bucket is connected through the `IMAGES` binding in `wrangler.jsonc`.

On first visit, the app opens the admin-key popup automatically. Enter the same `ADMIN_TOKEN`. After verification, the key is stored in that browser's `localStorage` until you clear it from the key icon or clear the site's browser data. The key is not included in settings exports.

For production, store it as an encrypted Worker secret rather than a Wrangler variable:

```bash
npx wrangler secret put ADMIN_TOKEN
```

Existing deployments using the former `AUTH_TOKEN` secret remain compatible, but new deployments should use `ADMIN_TOKEN`.

## Profiles

Each profile maps to one Cloudflare R2 bucket. Switching profiles keeps uploads, history, search, and deletion separated by bucket.

Examples:

- `Default` → `my-images`
- `Archive` → `archive-images`
- `Work` → `work-images`

### What Add profile does

The **Add profile (+)** button generates the configuration needed for `wrangler.jsonc`. It does not create a Cloudflare bucket or change the deployed Worker automatically.

1. Create the bucket and public image URL in Cloudflare.
2. Select **+** in the app header and complete the profile form.
3. Select **Copy setup** and merge both generated values into `wrangler.jsonc`.
4. Run `npm run deploy`.
5. Refresh the app to load the new profile.

### Cloudflare setup

1. Go to **R2 object storage → Overview → Create bucket** and create the bucket. Keep its exact name for the **R2 bucket name** field.
2. Open the bucket and go to **Settings → Public access → Custom Domains → Add / Connect Domain**. Use the active domain as the **Public image URL**. A Cloudflare `r2.dev` URL can be used for development.

See the Cloudflare documentation for [creating buckets](https://developers.cloudflare.com/r2/buckets/create-buckets/), [public bucket URLs](https://developers.cloudflare.com/r2/buckets/public-buckets/), and [Worker R2 bindings](https://developers.cloudflare.com/r2/get-started/workers-api/).

### Profile fields

All five fields are required.

| Field | Required | What to enter | Example |
| --- | --- | --- | --- |
| **Profile name** | Yes | The name shown in the app's profile switcher. Maximum 60 characters. | `Archive` |
| **Profile ID** | Yes | A stable 1–32 character ID using lowercase letters, numbers, and hyphens. | `archive` |
| **R2 bucket name** | Yes | The exact bucket name shown under **R2 object storage → Overview**. | `archive-images` |
| **Worker binding** | Yes | A unique JavaScript variable name used by the Worker. Uppercase letters and underscores are recommended. | `ARCHIVE_IMAGES` |
| **Public image URL** | Yes | The active URL under **Bucket → Settings → Public access**, without a trailing slash. | `https://archive-img.example.com` |

### Complete example

This example adds `archive-images` while keeping `my-images` as the default bucket:

```jsonc
{
  "r2_buckets": [
    {
      "binding": "IMAGES",
      "bucket_name": "my-images"
    },
    {
      "binding": "ARCHIVE_IMAGES",
      "bucket_name": "archive-images"
    }
  ],
  "vars": {
    "PUBLIC_BASE_URL": "https://img.example.com",
    "IMAGE_PROFILES": "[{\"id\":\"archive\",\"label\":\"Archive\",\"binding\":\"ARCHIVE_IMAGES\",\"publicBaseUrl\":\"https://archive-img.example.com\"}]"
  }
}
```

Keep these rules in mind:

- Keep the existing `IMAGES` binding and your chosen default bucket. They belong to the default profile.
- `ARCHIVE_IMAGES` must match exactly in `r2_buckets[].binding` and `IMAGE_PROFILES[].binding`.
- `archive-images` must match the bucket name in Cloudflare.
- `IMAGE_PROFILES` is a JSON array stored as a string. Add future profiles to the same array instead of replacing existing entries.
- **Copy setup** copies a fragment. Merge it into the existing configuration instead of replacing the entire `wrangler.jsonc` file.

Deploy the updated configuration:

```bash
npm run deploy
```

If the profile does not appear after refreshing, check that:

1. `IMAGE_PROFILES` is a valid JSON array string.
2. The binding names match exactly, including letter case.
3. `bucket_name` matches the Cloudflare bucket name.
4. The updated Worker has been deployed.
5. The custom domain status is **Active**.

For local testing, **Public image URL** can be `http://localhost:8787/profile-images/archive`. Wrangler uses local R2 storage by default, so local uploads do not change the production bucket.

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
| `npm run dev` | Starts Vite and the local Worker |
| `npm run dev:worker` | Starts only the local Worker |
| `npm run build` | Builds the React production assets |
| `npm test` | Runs the tests |
| `npm run lint` | Checks the code style |
| `npm run typecheck` | Checks TypeScript types |
| `npm run check` | Runs lint, type checking, tests, and the production build |
| `npm run deploy` | Deploys the Worker to Cloudflare |

## Deploy Your Own Instance

1. Sign in to Cloudflare and create an R2 bucket:

   ```bash
   npx wrangler login
   npx wrangler r2 bucket create my-images
   ```

2. If you have not created a local deployment configuration yet, copy the public template:

   ```bash
   cp wrangler.jsonc.example wrangler.jsonc
   ```

   Then update these placeholders in `wrangler.jsonc`:

   - `name`
   - `r2_buckets[0].bucket_name`
   - `vars.PUBLIC_BASE_URL`
   - `vars.CORS_ORIGINS` when another browser origin needs API access

3. Connect a custom domain or enable an `r2.dev` URL for the bucket. `PUBLIC_BASE_URL` only builds returned image URLs; it does not create or connect the domain.

4. For the first deployment, create a unique production admin key and store it as a Worker secret:

   ```bash
   openssl rand -hex 32
   npx wrangler secret put ADMIN_TOKEN
   ```

5. Deploy:

   ```bash
   npm run deploy
   ```

Wrangler only enforces a secret during deployment when it is listed under `secrets.required`. This template leaves that optional validation unset so existing deployments using the former `AUTH_TOKEN` remain compatible. For a new deployment, configure `ADMIN_TOKEN` once; Cloudflare keeps secrets across later `wrangler deploy` operations, so you only need to enter it again when rotating or recreating the secret. If neither token exists, the Worker still deploys but its management API rejects requests with `AUTH_NOT_CONFIGURED`. See Cloudflare's [Secrets documentation](https://developers.cloudflare.com/workers/configuration/secrets/).

## Keep a Private Deployment Config

If you want to deploy your own instance, keep personal resource names outside Git:

```bash
cp wrangler.jsonc.example wrangler.jsonc
```

Edit the `wrangler.jsonc` with your Worker name, bucket, public domain, CORS origins, and profile bindings. Then configure and deploy that Worker explicitly:

```bash
npm run deploy
```

The public `wrangler.jsonc.example` remains neutral while the ignored `wrangler.jsonc` continues to target your own Cloudflare resources. Use separate Worker names, buckets, public domains, and admin tokens for unrelated deployments.

## License

MIT. See [LICENSE](LICENSE).
