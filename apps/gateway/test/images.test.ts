import { describe, expect, it, vi } from "vitest";
import { handleRequest as handleWorkerRequest } from "../src";
import {
  createShortId,
  detectImageMime,
  normalizeFilename,
  normalizeFolder,
  normalizeTags,
  sanitizeFileBaseName,
} from "../src/images";
import type { Env } from "../src/types";

interface StoredObject {
  body: Uint8Array;
  cacheControl: string | undefined;
  contentType: string | undefined;
  customMetadata: Record<string, string> | undefined;
  uploaded: Date;
}

const ADMIN_TOKEN = "test-admin-token";

function handleRequest(request: Request, env: Env): Promise<Response> {
  if (request.method === "OPTIONS" || !new URL(request.url).pathname.startsWith("/api/")) {
    return handleWorkerRequest(request, env);
  }
  const headers = new Headers(request.headers);
  headers.set("Authorization", `Bearer ${ADMIN_TOKEN}`);
  return handleWorkerRequest(new Request(request, { headers }), env);
}

class FakeR2Bucket {
  readonly objects = new Map<string, StoredObject>();

  async put(key: string, value: unknown, options?: R2PutOptions): Promise<R2Object> {
    const body = new Uint8Array(await new Response(value as BodyInit).arrayBuffer());
    const uploaded = new Date();
    const contentType =
      options?.httpMetadata instanceof Headers
        ? (options.httpMetadata.get("content-type") ?? undefined)
        : options?.httpMetadata?.contentType;
    const cacheControl =
      options?.httpMetadata instanceof Headers
        ? (options.httpMetadata.get("cache-control") ?? undefined)
        : options?.httpMetadata?.cacheControl;
    this.objects.set(key, {
      body,
      cacheControl,
      contentType,
      customMetadata: options?.customMetadata,
      uploaded,
    });
    return this.object(key, this.objects.get(key)!);
  }

  async list(options?: R2ListOptions): Promise<R2Objects> {
    const entries = [...this.objects.entries()].filter(
      ([key]) => !options?.prefix || key.startsWith(options.prefix),
    );
    const offset = Number(options?.cursor ?? 0);
    const end = Math.min(offset + (options?.limit ?? entries.length), entries.length);
    const objects = entries
      .slice(offset, end)
      .map(([key, stored]) => this.object(key, stored));
    return {
      objects,
      truncated: end < entries.length,
      ...(end < entries.length ? { cursor: String(end) } : {}),
    } as R2Objects;
  }

  async head(key: string): Promise<R2Object | null> {
    const stored = this.objects.get(key);
    return stored ? this.object(key, stored) : null;
  }

  async get(key: string): Promise<R2ObjectBody | null> {
    const stored = this.objects.get(key);
    if (!stored) return null;

    return {
      ...this.object(key, stored),
      body: new Response(stored.body as unknown as BodyInit).body!,
      bodyUsed: false,
      arrayBuffer: () => new Response(stored.body as unknown as BodyInit).arrayBuffer(),
      bytes: () => Promise.resolve(stored.body),
      text: () => Promise.resolve(new TextDecoder().decode(stored.body)),
      json: async <T>() => JSON.parse(new TextDecoder().decode(stored.body)) as T,
      blob: () => Promise.resolve(new Blob([stored.body as unknown as BlobPart])),
      writeHttpMetadata(headers: Headers) {
        if (stored.contentType) headers.set("Content-Type", stored.contentType);
        if (stored.cacheControl) headers.set("Cache-Control", stored.cacheControl);
      },
    } as unknown as R2ObjectBody;
  }

  async delete(key: string | string[]): Promise<void> {
    for (const item of Array.isArray(key) ? key : [key]) {
      this.objects.delete(item);
    }
  }

  private object(key: string, stored: StoredObject): R2Object {
    return {
      key,
      version: "test-version",
      size: stored.body.byteLength,
      etag: "test-etag",
      httpEtag: '"test-etag"',
      checksums: {},
      uploaded: stored.uploaded,
      httpMetadata: {
        ...(stored.contentType ? { contentType: stored.contentType } : {}),
        ...(stored.cacheControl ? { cacheControl: stored.cacheControl } : {}),
      },
      customMetadata: stored.customMetadata,
      storageClass: "Standard",
      writeHttpMetadata() {},
    } as unknown as R2Object;
  }
}

function createEnv(bucket = new FakeR2Bucket()): Env {
  return {
    IMAGES: bucket as unknown as R2Bucket,
    ADMIN_TOKEN,
    PUBLIC_BASE_URL: "https://img.example.com",
    CORS_ORIGINS: "https://writer.example.com",
    MAX_UPLOAD_BYTES: "1024",
  };
}

function createProfileEnv(
  defaultBucket = new FakeR2Bucket(),
  archiveBucket = new FakeR2Bucket(),
): Env {
  return {
    ...createEnv(defaultBucket),
    ARCHIVE_IMAGES: archiveBucket as unknown as R2Bucket,
    IMAGE_PROFILES: [
      {
        id: "default",
        label: "Blog images",
        binding: "IMAGES",
        publicBaseUrl: "https://blog.example.com",
      },
      {
        id: "archive",
        label: "Archive",
        binding: "ARCHIVE_IMAGES",
        publicBaseUrl: "https://archive.example.com",
      },
    ],
  };
}

function pngFile(name = "My Screenshot.png", bytes?: Uint8Array): File {
  const content = bytes ?? new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return new File([content as unknown as BlobPart], name, { type: "image/png" });
}

describe("filename and signature safety", () => {
  it("removes traversal and unsafe filename characters", () => {
    expect(sanitizeFileBaseName("../../My Holiday <script>.PNG")).toBe("my-holiday-script");
  });

  it("creates an eight-character URL-safe image ID", () => {
    expect(createShortId(new Uint8Array([0, 0, 0, 0, 0, 0]))).toBe("AAAAAAAA");
    expect(createShortId(new Uint8Array([255, 255, 255, 255, 255, 255]))).toBe("________");
  });

  it("detects supported image signatures", () => {
    expect(detectImageMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(
      "image/png",
    );
    expect(detectImageMime(new TextEncoder().encode("not-an-image"))).toBeNull();
  });

  it("preserves readable filenames and normalizes duplicate tags", () => {
    expect(normalizeFilename("../../旅行照片 01.PNG")).toBe("旅行照片 01.PNG");
    expect(normalizeFilename("   ")).toBeNull();
    expect(normalizeTags([" Blog ", "作品", "blog"])).toEqual(["Blog", "作品"]);
    expect(normalizeTags([""])).toBeNull();
    expect(normalizeFolder("  作品  ")).toBe("作品");
    expect(normalizeFolder("nested/folder")).toBeNull();
    expect(normalizeFolder("x".repeat(81))).toBeNull();
  });
});

describe("request observability", () => {
  it("correlates safe error logs without request secrets or image metadata", async () => {
    const bucket = new FakeR2Bucket();
    bucket.head = async () => {
      throw new Error("private-photo.png secret-tag request-body");
    };
    const form = new FormData();
    form.set("file", pngFile("private-photo.png"));
    form.set("filename", "private-photo.png");
    form.set("tag", "secret-tag");
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await handleWorkerRequest(
      new Request("https://api.example.com/api/images?tag=secret-tag", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ADMIN_TOKEN}`,
          "CF-Ray": "test-request-id",
        },
        body: form,
      }),
      createEnv(bucket),
    );

    expect(response.status).toBe(500);
    expect(response.headers.get("X-Request-ID")).toBe("test-request-id");
    expect(log).toHaveBeenCalledWith("Unhandled Gateway request error", {
      requestId: "test-request-id",
      method: "POST",
      pathname: "/api/images",
      status: 500,
      error: "Error",
    });
    const logged = JSON.stringify(log.mock.calls);
    for (const secret of [ADMIN_TOKEN, "private-photo.png", "secret-tag", "request-body"]) {
      expect(logged).not.toContain(secret);
    }
    log.mockRestore();
  });
});

describe("image API", () => {
  it("returns a public health check", async () => {
    const response = await handleRequest(new Request("https://api.example.com/health"), createEnv());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { status: "ok", service: "r2-image-api" } });
  });

  it("requires a valid admin key for API routes", async () => {
    const response = await handleWorkerRequest(
      new Request("https://api.example.com/api/images"),
      createEnv(),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toContain("Bearer");
    expect(await response.json()).toMatchObject({ error: { code: "UNAUTHORIZED" } });

    const invalid = await handleWorkerRequest(
      new Request("https://api.example.com/api/images", {
        headers: { Authorization: "Bearer wrong-key" },
      }),
      createEnv(),
    );
    expect(invalid.status).toBe(401);

    const verified = await handleRequest(
      new Request("https://api.example.com/api/auth/verify"),
      createEnv(),
    );
    expect(verified.status).toBe(200);
    expect(await verified.json()).toEqual({ data: { authenticated: true } });
  });

  it("fails closed when no admin key is configured", async () => {
    const env = createEnv();
    delete env.ADMIN_TOKEN;
    const response = await handleWorkerRequest(
      new Request("https://api.example.com/api/images"),
      env,
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: "AUTH_NOT_CONFIGURED" } });
  });

  it("lists configured profiles without exposing bucket bindings", async () => {
    const response = await handleRequest(
      new Request("https://api.example.com/api/profiles"),
      createProfileEnv(),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: [
        { id: "default", label: "Blog images", isDefault: true },
        { id: "archive", label: "Archive", isDefault: false },
      ],
      limits: {
        maxUploadBytes: 1024,
        maxTags: 20,
        maxTagLength: 40,
      },
    });
  });

  it("logs safe request context for unexpected Worker errors", async () => {
    const bucket = new FakeR2Bucket();
    vi.spyOn(bucket, "list").mockRejectedValue(new Error("R2 unavailable"));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await handleRequest(
      new Request("https://api.example.com/api/images?private=secret", {
        headers: { "CF-Ray": "list-request-id" },
      }),
      createEnv(bucket),
    );

    expect(response.status).toBe(500);
    expect(response.headers.get("X-Request-ID")).toBe("list-request-id");
    expect(errorLog).toHaveBeenCalledWith(
      "Unhandled Gateway request error",
      {
        requestId: "list-request-id",
        method: "GET",
        pathname: "/api/images",
        status: 500,
        error: "Error",
      },
    );
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain("private=secret");
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(ADMIN_TOKEN);
    errorLog.mockRestore();
  });

  it("keeps profile uploads and image reads isolated by bucket", async () => {
    const defaultBucket = new FakeR2Bucket();
    const archiveBucket = new FakeR2Bucket();
    const env = createProfileEnv(defaultBucket, archiveBucket);
    const form = new FormData();
    form.set("file", pngFile("archive.png"));

    const upload = await handleRequest(
      new Request("https://api.example.com/api/images?profile=archive", {
        method: "POST",
        body: form,
      }),
      env,
    );
    expect(upload.status).toBe(201);
    const uploaded = (await upload.json()) as {
      data: { profileId: string; key: string; url: string };
    };
    expect(uploaded.data).toMatchObject({
      profileId: "archive",
      url: `https://archive.example.com/${uploaded.data.key}`,
    });
    expect(defaultBucket.objects.size).toBe(0);
    expect(archiveBucket.objects.has(uploaded.data.key)).toBe(true);

    const defaultList = await handleRequest(
      new Request("https://api.example.com/api/images"),
      env,
    );
    expect(await defaultList.json()).toMatchObject({ data: [] });

    const archiveImage = await handleRequest(
      new Request(`https://api.example.com/profile-images/archive/${uploaded.data.key}`),
      env,
    );
    expect(archiveImage.status).toBe(200);
  });

  it("rejects unknown profile IDs", async () => {
    const response = await handleRequest(
      new Request("https://api.example.com/api/images?profile=missing"),
      createProfileEnv(),
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: "PROFILE_NOT_FOUND" } });
  });

  it("handles CORS preflight only for configured origins", async () => {
    const sameOrigin = await handleRequest(
      new Request("https://api.example.com/api/images", {
        method: "OPTIONS",
        headers: { Origin: "https://api.example.com" },
      }),
      createEnv(),
    );
    expect(sameOrigin.status).toBe(204);
    expect(sameOrigin.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://api.example.com",
    );

    const allowed = await handleRequest(
      new Request("https://api.example.com/api/images", {
        method: "OPTIONS",
        headers: { Origin: "https://writer.example.com" },
      }),
      createEnv(),
    );
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe("https://writer.example.com");
    expect(allowed.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");

    const denied = await handleRequest(
      new Request("https://api.example.com/api/images", {
        method: "OPTIONS",
        headers: { Origin: "https://attacker.example.com" },
      }),
      createEnv(),
    );
    expect(denied.status).toBe(403);
  });

  it("uploads, lists, and deletes an image", async () => {
    const bucket = new FakeR2Bucket();
    const env = createEnv(bucket);
    const form = new FormData();
    form.set("file", pngFile());

    const upload = await handleRequest(
      new Request("https://api.example.com/api/images", {
        method: "POST",
        body: form,
      }),
      env,
    );
    expect(upload.status).toBe(201);
    const uploadBody = (await upload.json()) as { data: { key: string; url: string } };
    expect(uploadBody.data.key).toMatch(/^[A-Za-z0-9_-]{8}$/u);
    expect(uploadBody.data.url).toBe(`https://img.example.com/${uploadBody.data.key}`);
    expect(bucket.objects.has(uploadBody.data.key)).toBe(true);
    expect(bucket.objects.get(uploadBody.data.key)?.cacheControl).toBe(
      "public, max-age=0, must-revalidate",
    );

    const list = await handleRequest(
      new Request("https://api.example.com/api/images"),
      env,
    );
    expect(list.status).toBe(200);
    expect(await list.json()).toMatchObject({ data: [{ key: uploadBody.data.key }] });

    const image = await handleRequest(
      new Request(`https://api.example.com/images/${uploadBody.data.key}`),
      env,
    );
    expect(image.status).toBe(200);
    expect(image.headers.get("Content-Type")).toBe("image/png");
    expect(image.headers.get("Cache-Control")).toBe("public, max-age=0, must-revalidate");
    expect(image.headers.get("Cloudflare-CDN-Cache-Control")).toBe(
      "public, max-age=0, must-revalidate",
    );
    expect(image.headers.get("Content-Security-Policy")).toBe("default-src 'none'; sandbox");
    expect(new Uint8Array(await image.arrayBuffer())).toEqual(
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );

    const deletion = await handleRequest(
      new Request(
        `https://api.example.com/api/images?key=${encodeURIComponent(uploadBody.data.key)}`,
        { method: "DELETE" },
      ),
      env,
    );
    expect(deletion.status).toBe(200);
    expect(bucket.objects.has(uploadBody.data.key)).toBe(false);
  });

  it("rejects executable content types from public image routes", async () => {
    const defaultBucket = new FakeR2Bucket();
    const archiveBucket = new FakeR2Bucket();
    const env = createProfileEnv(defaultBucket, archiveBucket);
    const activeContent = new TextEncoder().encode("<script>alert('unsafe')</script>");

    await defaultBucket.put("html-object", activeContent, {
      httpMetadata: { contentType: "text/html" },
    });
    await archiveBucket.put("svg-object", activeContent, {
      httpMetadata: { contentType: "image/svg+xml" },
    });

    const defaultResponse = await handleRequest(
      new Request("https://api.example.com/images/html-object"),
      env,
    );
    const profileResponse = await handleRequest(
      new Request("https://api.example.com/profile-images/archive/svg-object"),
      env,
    );

    expect(defaultResponse.status).toBe(415);
    expect(profileResponse.status).toBe(415);
    await expect(defaultResponse.json()).resolves.toMatchObject({
      error: { code: "UNSUPPORTED_MEDIA_TYPE" },
    });
    await expect(profileResponse.json()).resolves.toMatchObject({
      error: { code: "UNSUPPORTED_MEDIA_TYPE" },
    });
  });

  it("keeps the original upload filename and supports zero or multiple tags", async () => {
    const bucket = new FakeR2Bucket();
    const env = createEnv(bucket);

    const firstForm = new FormData();
    firstForm.set("file", pngFile("optimized.webp"));
    firstForm.set("filename", "旅行照片.png");
    firstForm.append("tag", "Blog");
    firstForm.append("tag", "Cover");
    const firstUpload = await handleRequest(
      new Request("https://api.example.com/api/images", { method: "POST", body: firstForm }),
      env,
    );
    const first = (await firstUpload.json()) as {
      data: { key: string; filename: string; originalName: string; tags: string[] };
    };
    expect(first.data).toMatchObject({
      filename: "旅行照片.png",
      originalName: "旅行照片.png",
      tags: ["Blog", "Cover"],
    });

    const secondForm = new FormData();
    secondForm.set("file", pngFile("second.png"));
    secondForm.append("tag", "Blog");
    await handleRequest(
      new Request("https://api.example.com/api/images", { method: "POST", body: secondForm }),
      env,
    );

    const untaggedForm = new FormData();
    untaggedForm.set("file", pngFile("untagged.png"));
    const untaggedUpload = await handleRequest(
      new Request("https://api.example.com/api/images", { method: "POST", body: untaggedForm }),
      env,
    );
    expect(await untaggedUpload.json()).toMatchObject({ data: { tags: [] } });

    const all = await handleRequest(new Request("https://api.example.com/api/images"), env);
    expect(((await all.json()) as { data: unknown[] }).data).toHaveLength(3);

    const cover = await handleRequest(
      new Request("https://api.example.com/api/images?tag=cover"),
      env,
    );
    expect(await cover.json()).toMatchObject({
      data: [{ key: first.data.key, tags: ["Blog", "Cover"] }],
    });

    const blogAndCover = await handleRequest(
      new Request("https://api.example.com/api/images?limit=1&tag=blog&tag=cover"),
      env,
    );
    expect(await blogAndCover.json()).toMatchObject({
      data: [{ key: first.data.key }],
      pagination: { truncated: false, cursor: null },
    });
  });

  it("sorts images by upload date before applying pagination", async () => {
    const bucket = new FakeR2Bucket();
    const env = createEnv(bucket);
    const uploads: string[] = [];

    for (const name of ["middle.png", "oldest.png", "newest.png"]) {
      const form = new FormData();
      form.set("file", pngFile(name));
      const response = await handleRequest(
        new Request("https://api.example.com/api/images", { method: "POST", body: form }),
        env,
      );
      uploads.push(((await response.json()) as { data: { key: string } }).data.key);
    }

    bucket.objects.get(uploads[0]!)!.customMetadata!.uploadedAt = "2026-08-20T00:00:00.000Z";
    bucket.objects.get(uploads[1]!)!.customMetadata!.uploadedAt = "2026-08-10T00:00:00.000Z";
    bucket.objects.get(uploads[2]!)!.customMetadata!.uploadedAt = "2026-08-24T00:00:00.000Z";

    const firstPage = await handleRequest(
      new Request("https://api.example.com/api/images?limit=2"),
      env,
    );
    expect(await firstPage.json()).toMatchObject({
      data: [{ key: uploads[2] }, { key: uploads[0] }],
      pagination: { truncated: true, cursor: "2" },
    });

    const secondPage = await handleRequest(
      new Request("https://api.example.com/api/images?limit=2&cursor=2"),
      env,
    );
    expect(await secondPage.json()).toMatchObject({
      data: [{ key: uploads[1] }],
      pagination: { truncated: false, cursor: null },
    });
  });

  it("counts the whole Profile across R2 pages and clamps filtered pagination after deletion", async () => {
    const bucket = new FakeR2Bucket();
    for (let index = 0; index < 1002; index += 1) {
      await bucket.put(`photo/${index}`, new Uint8Array(10), {
        httpMetadata: { contentType: "image/png" },
        customMetadata: { tags: JSON.stringify(index < 3 ? ["featured"] : []) },
      });
    }
    const env = createProfileEnv(bucket);
    const request = () => handleRequest(new Request("https://api.example.com/api/images?tag=featured&limit=2&cursor=2"), env);
    expect(await (await request()).json()).toMatchObject({
      summary: { total: 1002, totalBytes: 10020 },
      pagination: { offset: 2, total: 3, totalBytes: 30, cursor: null },
    });
    await handleRequest(new Request("https://api.example.com/api/images?key=photo/2", { method: "DELETE" }), env);
    expect(await (await request()).json()).toMatchObject({
      summary: { total: 1001, totalBytes: 10010 },
      pagination: { offset: 0, total: 2, totalBytes: 20, cursor: null },
    });
    const empty = await handleRequest(new Request("https://api.example.com/api/images?tag=missing&cursor=500"), env);
    expect(await empty.json()).toMatchObject({ data: [], pagination: { offset: 0, total: 0 }, summary: { total: 1001 } });
    const archive = await handleRequest(new Request("https://api.example.com/api/images?profile=archive"), env);
    expect(await archive.json()).toMatchObject({ summary: { total: 0, totalBytes: 0 } });
    const prefix = await handleRequest(new Request("https://api.example.com/api/images?prefix=missing"), env);
    expect(await prefix.json()).toMatchObject({ data: [], summary: { total: 1001 } });
  });

  it("persists dimensions parsed from the uploaded bytes and keeps legacy dimensions unknown", async () => {
    const bucket = new FakeR2Bucket();
    const env = createEnv(bucket);
    const form = new FormData();
    const bytes = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII="), (char) => char.charCodeAt(0));
    form.set("file", pngFile("pixel.png", bytes));
    form.set("width", "9999");
    form.set("height", "9999");
    const response = await handleRequest(new Request("https://api.example.com/api/images", { method: "POST", body: form }), env);
    const result = await response.json() as { data: { key: string; width: number; height: number } };
    expect(result.data).toMatchObject({ width: 1, height: 1 });
    expect(bucket.objects.get(result.data.key)?.customMetadata).toMatchObject({ width: "1", height: "1" });
    const update = await handleRequest(new Request(`https://api.example.com/api/images?key=${result.data.key}`, { method: "PATCH", body: JSON.stringify({ tags: ["test"] }) }), env);
    expect(await update.json()).toMatchObject({ data: { width: 1, height: 1 } });
    await bucket.put("legacy", bytes, { httpMetadata: { contentType: "image/png" } });
    const get = vi.spyOn(bucket, "get");
    const list = await handleRequest(new Request("https://api.example.com/api/images"), env);
    expect((await list.json() as { data: unknown[] }).data).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "legacy", width: null, height: null }),
      expect.objectContaining({ key: result.data.key, width: 1, height: 1 }),
    ]));
    expect(get).not.toHaveBeenCalled();
  });

  it("updates display filename and tags without changing the key or file bytes", async () => {
    const bucket = new FakeR2Bucket();
    const env = createEnv(bucket);
    const form = new FormData();
    form.set("file", pngFile("original.png"));
    form.append("tag", "Old");

    const upload = await handleRequest(
      new Request("https://api.example.com/api/images", { method: "POST", body: form }),
      env,
    );
    const uploaded = (await upload.json()) as { data: { key: string } };
    const before = bucket.objects.get(uploaded.data.key)?.body;

    const update = await handleRequest(
      new Request(
        `https://api.example.com/api/images?key=${encodeURIComponent(uploaded.data.key)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: "首頁封面.png", tags: ["Blog", "Featured"] }),
        },
      ),
      env,
    );
    expect(update.status).toBe(200);
    expect(await update.json()).toMatchObject({
      data: {
        key: uploaded.data.key,
        originalName: "original.png",
        filename: "首頁封面.png",
        tags: ["Blog", "Featured"],
      },
    });
    expect(bucket.objects.get(uploaded.data.key)?.body).toEqual(before);

    const oldTag = await handleRequest(
      new Request("https://api.example.com/api/images?tag=Old"),
      env,
    );
    expect(await oldTag.json()).toMatchObject({ data: [] });

    const newTag = await handleRequest(
      new Request("https://api.example.com/api/images?tag=featured"),
      env,
    );
    expect(await newTag.json()).toMatchObject({
      data: [{ key: uploaded.data.key, filename: "首頁封面.png" }],
    });
  });

  it("adds tags without losing existing metadata, supports idempotent retry and rejects overflow", async () => {
    const bucket = new FakeR2Bucket();
    const env = createEnv(bucket);
    const originalTags = ["Blog", ...Array.from({ length: 18 }, (_, index) => `tag-${index}`)];
    await bucket.put("image", new Uint8Array([1, 2]), { customMetadata: { tags: JSON.stringify(originalTags), width: "640", height: "480", uploadedAt: "2026-01-01T00:00:00.000Z" } });
    const patch = (body: unknown) => handleRequest(new Request("https://api.example.com/api/images?key=image", { method: "PATCH", body: JSON.stringify(body) }), env);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await patch({ addTags: ["ｂｌｏｇ", " New "] });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ data: { tags: [...originalTags, "New"], width: 640, height: 480, uploadedAt: "2026-01-01T00:00:00.000Z" } });
    }
    expect(await (await patch({ addTags: ["overflow"] })).json()).toMatchObject({ error: { code: "INVALID_TAGS" } });
    expect(await (await patch({ addTags: [], tags: [] })).json()).toMatchObject({ error: { code: "INVALID_METADATA" } });
    expect((await patch({ addTags: [42] })).status).toBe(400);
    expect((await patch({ addTags: ["x".repeat(41)] })).status).toBe(400);
    expect(bucket.objects.get("image")?.body).toEqual(new Uint8Array([1, 2]));
    expect(JSON.parse(bucket.objects.get("image")!.customMetadata!.tags!)).toHaveLength(20);
    const anonymous = await handleWorkerRequest(new Request("https://api.example.com/api/images?key=image", { method: "PATCH", body: JSON.stringify({ addTags: ["new"] }) }), env);
    expect(anonymous.status).toBe(401);
  });

  it("moves images between logical folders without changing keys, URLs or bytes", async () => {
    const bucket = new FakeR2Bucket();
    const archive = new FakeR2Bucket();
    const env = createProfileEnv(bucket, archive);
    await bucket.put("one", new Uint8Array([1]), { customMetadata: { tags: JSON.stringify(["Blog"]) } });
    await bucket.put("two", new Uint8Array([2]), { customMetadata: { tags: JSON.stringify(["Blog"]), folder: "Archive" } });
    await bucket.put("three", new Uint8Array([3]), { customMetadata: { folder: "Portfolio" } });
    const move = (key: string, folder: unknown) => handleRequest(new Request(`https://api.example.com/api/images?key=${key}`, { method: "PATCH", body: JSON.stringify({ folder }) }), env);
    const moved = await move("one", "  Portfolio  ");
    expect(await moved.json()).toMatchObject({ data: { key: "one", url: "https://img.example.com/one", folder: "Portfolio" } });
    expect(bucket.objects.get("one")?.body).toEqual(new Uint8Array([1]));
    const filtered = await handleRequest(new Request("https://api.example.com/api/images?folder=Portfolio&tag=blog"), env);
    expect(await filtered.json()).toMatchObject({
      data: [{ key: "one", folder: "Portfolio" }],
      summary: { total: 3, folders: ["Archive", "Portfolio"] },
      pagination: { total: 1 },
    });
    await move("one", "");
    expect(bucket.objects.get("one")?.customMetadata?.folder).toBeUndefined();
    const unfiled = await handleRequest(new Request("https://api.example.com/api/images?folder="), env);
    expect(await unfiled.json()).toMatchObject({ data: [{ key: "one", folder: null }] });
    expect((await move("one", "bad/name")).status).toBe(400);
    expect((await move("one", 42)).status).toBe(400);
    const archiveList = await handleRequest(new Request("https://api.example.com/api/images?profile=archive&folder=Portfolio"), env);
    expect(await archiveList.json()).toMatchObject({ data: [], summary: { folders: [] } });
  });

  it("rejects invalid metadata updates", async () => {
    const missingKey = await handleRequest(
      new Request("https://api.example.com/api/images", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: ["Blog"] }),
      }),
      createEnv(),
    );
    expect(missingKey.status).toBe(400);

    const invalidBody = await handleRequest(
      new Request("https://api.example.com/api/images?key=valid-key", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: [""] }),
      }),
      createEnv(),
    );
    expect(invalidBody.status).toBe(400);
    expect(await invalidBody.json()).toMatchObject({ error: { code: "INVALID_TAGS" } });
  });

  it("rejects content whose signature does not match its MIME type", async () => {
    const form = new FormData();
    form.set(
      "file",
      new File(
        [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
        "fake.jpg",
        { type: "image/jpeg" },
      ),
    );
    const response = await handleRequest(
      new Request("https://api.example.com/api/images", {
        method: "POST",
        body: form,
      }),
      createEnv(),
    );
    expect(response.status).toBe(415);
    expect(await response.json()).toMatchObject({ error: { code: "MIME_MISMATCH" } });
  });

  it("uses the file signature when a client sends a generic MIME type", async () => {
    const bucket = new FakeR2Bucket();
    const form = new FormData();
    form.set(
      "file",
      new File(
        [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
        "postman-upload.png",
        { type: "application/octet-stream" },
      ),
    );
    const response = await handleRequest(
      new Request("https://api.example.com/api/images", {
        method: "POST",
        body: form,
      }),
      createEnv(bucket),
    );
    expect(response.status).toBe(201);
    const body = (await response.json()) as { data: { key: string; contentType: string } };
    expect(body.data.key).toMatch(/^[A-Za-z0-9_-]{8}$/u);
    expect(body.data.contentType).toBe("image/png");
    expect(bucket.objects.get(body.data.key)?.contentType).toBe("image/png");
  });

  it("rejects bytes that are not a supported image", async () => {
    const form = new FormData();
    form.set(
      "file",
      new File([new TextEncoder().encode("not an image")], "fake.png", { type: "image/png" }),
    );
    const response = await handleRequest(
      new Request("https://api.example.com/api/images", {
        method: "POST",
        body: form,
      }),
      createEnv(),
    );
    expect(response.status).toBe(415);
    expect(await response.json()).toMatchObject({
      error: { code: "UNSUPPORTED_MEDIA_TYPE" },
    });
  });

  it("rejects files over the configured size limit", async () => {
    const env = createEnv();
    env.MAX_UPLOAD_BYTES = "7";
    const form = new FormData();
    form.set("file", pngFile());
    const response = await handleRequest(
      new Request("https://api.example.com/api/images", {
        method: "POST",
        body: form,
      }),
      env,
    );
    expect(response.status).toBe(413);
  });
});
