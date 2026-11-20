import type { Env } from "./types";

export interface AccessPolicy {
  mode: "access";
  teamDomain: string;
  audience: string;
  allowedEmails: ReadonlySet<string>;
}

export type AccessConfig = AccessPolicy | { mode: "dev"; email: string };

export type AccessFailure =
  | "missing token"
  | "malformed token"
  | "unsupported algorithm"
  | "unknown signing key"
  | "invalid signature"
  | "wrong issuer"
  | "wrong audience"
  | "token expired"
  | "token not yet valid"
  | "email not allowed";

export type AccessVerification =
  | { ok: true; email: string }
  | { ok: false; reason: AccessFailure };

export type AccessKeyLookup = (kid: string) => Promise<CryptoKey | null>;

const TEAM_DOMAIN_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/u;
const textEncoder = new TextEncoder();

function setting(value: string | undefined): string {
  return value?.trim() ?? "";
}

export function parseAccessConfig(env: Env): AccessConfig | null {
  const teamDomain = setting(env.ACCESS_TEAM_DOMAIN)
    .toLowerCase()
    .replace(/^https:\/\//u, "")
    .replace(/\/+$/u, "");
  const devEmail = setting(env.ACCESS_DEV_EMAIL).toLowerCase();

  if (!teamDomain) return devEmail ? { mode: "dev", email: devEmail } : null;
  if (devEmail || !TEAM_DOMAIN_PATTERN.test(teamDomain)) return null;

  const audience = setting(env.ACCESS_AUD);
  const allowedEmails = new Set(
    setting(env.ACCESS_ALLOWED_EMAILS)
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
  if (!audience || allowedEmails.size === 0) return null;
  return { mode: "access", teamDomain, audience, allowedEmails };
}

function base64UrlBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/gu, "+").replace(/_/gu, "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeSegment(value: string): Record<string, unknown> | null {
  try {
    const decoded: unknown = JSON.parse(new TextDecoder().decode(base64UrlBytes(value)));
    return decoded && typeof decoded === "object" && !Array.isArray(decoded)
      ? (decoded as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function audiences(value: unknown): string[] {
  if (typeof value === "string") return [value];
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

export async function verifyAccessJwt(
  token: string,
  policy: AccessPolicy,
  keyFor: AccessKeyLookup,
  nowSeconds: number,
): Promise<AccessVerification> {
  if (!token) return { ok: false, reason: "missing token" };
  const segments = token.split(".");
  if (segments.length !== 3) return { ok: false, reason: "malformed token" };
  const [encodedHeader, encodedPayload, encodedSignature] = segments as [string, string, string];
  const header = decodeSegment(encodedHeader);
  const claims = decodeSegment(encodedPayload);
  if (!header || !claims || typeof header.kid !== "string") {
    return { ok: false, reason: "malformed token" };
  }
  if (header.alg !== "RS256") return { ok: false, reason: "unsupported algorithm" };

  const key = await keyFor(header.kid);
  if (!key) return { ok: false, reason: "unknown signing key" };

  let signature: Uint8Array<ArrayBuffer>;
  try {
    signature = base64UrlBytes(encodedSignature);
  } catch {
    return { ok: false, reason: "malformed token" };
  }
  const signed = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    signature,
    textEncoder.encode(`${encodedHeader}.${encodedPayload}`),
  );
  if (!signed) return { ok: false, reason: "invalid signature" };

  if (claims.iss !== `https://${policy.teamDomain}`) return { ok: false, reason: "wrong issuer" };
  if (!audiences(claims.aud).includes(policy.audience)) {
    return { ok: false, reason: "wrong audience" };
  }
  if (typeof claims.exp !== "number" || claims.exp <= nowSeconds) {
    return { ok: false, reason: "token expired" };
  }
  if (claims.nbf !== undefined && (typeof claims.nbf !== "number" || claims.nbf > nowSeconds)) {
    return { ok: false, reason: "token not yet valid" };
  }
  const email = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "";
  if (!policy.allowedEmails.has(email)) return { ok: false, reason: "email not allowed" };
  return { ok: true, email };
}
