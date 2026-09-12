import { requireAdmin } from "./auth";
import { getCors, error, json } from "./http";
import {
  deleteImage,
  listImages,
  serveImage,
  updateImage,
  uploadImage,
  workspaceLimits,
} from "./images";
import { publicImageProfiles } from "./profiles";
import type { CorsResult, Env } from "./types";

const IMAGE_ROUTE = "/api/images";
const REQUEST_ID_HEADER = "X-Request-ID";

async function routeRequest(request: Request, env: Env, cors: CorsResult): Promise<Response> {
  if (!cors.allowed) {
    return error("CORS_ORIGIN_DENIED", "This origin is not allowed", 403, cors.headers);
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors.headers });
  }

  const url = new URL(request.url);
  if (url.pathname === "/health" && request.method === "GET") {
    return json(
      {
        data: {
          status: "ok",
          service: "r2-image-api",
          timestamp: new Date().toISOString(),
        },
      },
      200,
      cors.headers,
    );
  }

  if (url.pathname.startsWith("/images/") && request.method === "GET") {
    return serveImage(url.pathname.slice("/images/".length), env, cors.headers);
  }

  if (url.pathname.startsWith("/profile-images/") && request.method === "GET") {
    const [profileId, ...keyParts] = url.pathname.slice("/profile-images/".length).split("/");
    return serveImage(keyParts.join("/"), env, cors.headers, profileId);
  }

  if (url.pathname.startsWith("/api/")) {
    const authFailure = await requireAdmin(request, env, cors.headers);
    if (authFailure) return authFailure;
  }

  if (url.pathname === "/api/auth/verify" && request.method === "GET") {
    return json({ data: { authenticated: true } }, 200, cors.headers);
  }

  if (url.pathname === "/api/profiles" && request.method === "GET") {
    return json(
      { data: publicImageProfiles(env), limits: workspaceLimits(env) },
      200,
      cors.headers,
    );
  }

  if (url.pathname !== IMAGE_ROUTE) {
    return error("NOT_FOUND", "Route not found", 404, cors.headers);
  }

  if (request.method === "POST") return uploadImage(request, env, cors.headers);
  if (request.method === "GET") return listImages(request, env, cors.headers);
  if (request.method === "PATCH") return updateImage(request, env, cors.headers);
  if (request.method === "DELETE") return deleteImage(request, env, cors.headers);

  const headers = new Headers(cors.headers);
  headers.set("Allow", "GET, POST, PATCH, DELETE, OPTIONS");
  return error("METHOD_NOT_ALLOWED", "Method not allowed", 405, headers);
}

function withRequestId(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers);
  headers.set(REQUEST_ID_HEADER, requestId);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const requestId = request.headers.get("CF-Ray")?.trim() || crypto.randomUUID();
  const rawPathname = new URL(request.url).pathname;
  const pathname = rawPathname.startsWith("/images/")
    ? "/images/:key"
    : rawPathname.startsWith("/profile-images/")
      ? "/profile-images/:profile/:key"
      : rawPathname;
  let corsHeaders: Headers | undefined;

  try {
    const cors = getCors(request, env);
    corsHeaders = cors.headers;
    return withRequestId(await routeRequest(request, env, cors), requestId);
  } catch (cause) {
    console.error("Unhandled Gateway request error", {
      requestId,
      method: request.method,
      pathname,
      status: 500,
      error: cause instanceof Error ? "Error" : "NonErrorThrow",
    });
    return withRequestId(
      error("INTERNAL_ERROR", "An unexpected error occurred", 500, corsHeaders),
      requestId,
    );
  }
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },
} satisfies ExportedHandler<Env>;
