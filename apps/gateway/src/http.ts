import type { CorsResult, Env } from "./types";
import type { ApiErrorResponse } from "@image-hoisting/contracts";

const CORS_METHODS = "GET, POST, PATCH, DELETE, OPTIONS";
const CORS_HEADERS = "Authorization, Content-Type";

export function getCors(request: Request, env: Env): CorsResult {
  const headers = new Headers({ Vary: "Origin" });
  const origin = request.headers.get("Origin");

  if (!origin) {
    return { allowed: true, headers };
  }

  const allowedOrigins = (env.CORS_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const sameOrigin = origin === new URL(request.url).origin;
  const allowsEveryOrigin = allowedOrigins.includes("*");
  const allowed = sameOrigin || allowsEveryOrigin || allowedOrigins.includes(origin);

  if (allowed) {
    headers.set("Access-Control-Allow-Origin", allowsEveryOrigin && !sameOrigin ? "*" : origin);
    headers.set("Access-Control-Allow-Methods", CORS_METHODS);
    headers.set("Access-Control-Allow-Headers", CORS_HEADERS);
    headers.set("Access-Control-Max-Age", "86400");
  }

  return { allowed, headers };
}

export function json(data: unknown, status = 200, headers?: Headers): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Content-Type", "application/json; charset=utf-8");
  responseHeaders.set("X-Content-Type-Options", "nosniff");
  return Response.json(data, { status, headers: responseHeaders });
}

export function error(
  code: string,
  message: string,
  status: number,
  headers?: Headers,
): Response {
  return json({ error: { code, message } } satisfies ApiErrorResponse, status, headers);
}
