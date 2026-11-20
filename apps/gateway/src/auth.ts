import { parseAccessConfig, verifyAccessJwt } from "./access";
import { error } from "./http";
import type { Env } from "./types";

const ACCESS_JWT_HEADER = "Cf-Access-Jwt-Assertion";
const SIGNING_KEYS_TTL_MS = 60 * 60 * 1000;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

interface SigningKeys {
  teamDomain: string;
  fetchedAt: number;
  keys: ReadonlyMap<string, CryptoKey>;
}

let signingKeys: SigningKeys | null = null;

async function fetchSigningKeys(teamDomain: string, now: number): Promise<SigningKeys> {
  const response = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!response.ok) throw new Error(`Cloudflare Access certs request failed: ${response.status}`);
  const body = (await response.json()) as { keys?: unknown };
  const keys = new Map<string, CryptoKey>();
  for (const jwk of Array.isArray(body.keys) ? body.keys : []) {
    const candidate = jwk as JsonWebKey & { kid?: unknown };
    if (typeof candidate.kid !== "string" || candidate.kty !== "RSA") continue;
    keys.set(
      candidate.kid,
      await crypto.subtle.importKey(
        "jwk",
        candidate,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"],
      ),
    );
  }
  return { teamDomain, fetchedAt: now, keys };
}

async function signingKey(teamDomain: string, kid: string): Promise<CryptoKey | null> {
  const now = Date.now();
  const cached = signingKeys;
  const fresh =
    cached?.teamDomain === teamDomain && now - cached.fetchedAt < SIGNING_KEYS_TTL_MS;
  if (!fresh || !cached.keys.has(kid)) {
    signingKeys = await fetchSigningKeys(teamDomain, now);
  }
  return signingKeys?.keys.get(kid) ?? null;
}

export async function requireAccess(
  request: Request,
  env: Env,
  headers: Headers,
): Promise<Response | null> {
  const config = parseAccessConfig(env);
  if (!config) {
    return error("AUTH_NOT_CONFIGURED", "Cloudflare Access is not configured", 503, headers);
  }

  if (config.mode === "dev") {
    if (LOOPBACK_HOSTS.has(new URL(request.url).hostname)) return null;
    return error(
      "AUTH_NOT_CONFIGURED",
      "ACCESS_DEV_EMAIL only works on localhost",
      503,
      headers,
    );
  }

  const verification = await verifyAccessJwt(
    request.headers.get(ACCESS_JWT_HEADER)?.trim() ?? "",
    config,
    (kid) => signingKey(config.teamDomain, kid),
    Math.floor(Date.now() / 1000),
  );
  if (verification.ok) return null;
  return error(
    "UNAUTHORIZED",
    `Cloudflare Access rejected this request: ${verification.reason}`,
    401,
    headers,
  );
}
