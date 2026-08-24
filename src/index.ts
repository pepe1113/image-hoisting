import { requireAdmin } from "./auth";
import { getCors, error, json } from "./http";
import { deleteImage, listImages, serveImage, updateImage, uploadImage } from "./images";
import { publicImageProfiles } from "./profiles";
import type { Env } from "./types";

const IMAGE_ROUTE = "/api/images";

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const cors = getCors(request, env);
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
    return json({ data: publicImageProfiles(env) }, 200, cors.headers);
  }

  if (url.pathname !== IMAGE_ROUTE) {
    return error("NOT_FOUND", "Route not found", 404, cors.headers);
  }

  try {
    if (request.method === "POST") {
      return await uploadImage(request, env, cors.headers);
    }
    if (request.method === "GET") {
      return await listImages(request, env, cors.headers);
    }
    if (request.method === "PATCH") {
      return await updateImage(request, env, cors.headers);
    }
    if (request.method === "DELETE") {
      return await deleteImage(request, env, cors.headers);
    }
  } catch {
    return error("INTERNAL_ERROR", "An unexpected error occurred", 500, cors.headers);
  }

  const headers = new Headers(cors.headers);
  headers.set("Allow", "GET, POST, PATCH, DELETE, OPTIONS");
  return error("METHOD_NOT_ALLOWED", "Method not allowed", 405, headers);
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },
} satisfies ExportedHandler<Env>;
