import { error } from "./http";
import type { Env } from "./types";

const textEncoder = new TextEncoder();

function configuredAdminToken(env: Env): string {
  return (env.ADMIN_TOKEN ?? env.AUTH_TOKEN ?? "").trim();
}

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", textEncoder.encode(value)));
}

async function tokensMatch(actual: string, expected: string): Promise<boolean> {
  const [actualDigest, expectedDigest] = await Promise.all([digest(actual), digest(expected)]);
  let difference = 0;
  for (let index = 0; index < actualDigest.length; index += 1) {
    difference |= actualDigest[index]! ^ expectedDigest[index]!;
  }
  return difference === 0;
}

export async function requireAdmin(
  request: Request,
  env: Env,
  headers: Headers,
): Promise<Response | null> {
  const expected = configuredAdminToken(env);
  if (!expected) {
    return error(
      "AUTH_NOT_CONFIGURED",
      "Admin authentication is not configured",
      503,
      headers,
    );
  }

  const authorization = request.headers.get("Authorization") ?? "";
  const match = /^Bearer\s+(.+)$/u.exec(authorization);
  const actual = match?.[1]?.trim() ?? "";
  if (!actual || !(await tokensMatch(actual, expected))) {
    const responseHeaders = new Headers(headers);
    responseHeaders.set("WWW-Authenticate", 'Bearer realm="r2-image-api"');
    return error("UNAUTHORIZED", "A valid admin key is required", 401, responseHeaders);
  }

  return null;
}
