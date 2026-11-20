import { vi } from "vitest";
import type { Env } from "../src/types";

export const TEAM_DOMAIN = "test-team.cloudflareaccess.com";
export const AUDIENCE = "test-access-audience";
export const OWNER_EMAIL = "owner@example.com";

export interface SigningIdentity {
  kid: string;
  privateKey: CryptoKey;
  publicJwk: JsonWebKey & { kid: string };
}

export const ACCESS_ENV = {
  ACCESS_TEAM_DOMAIN: TEAM_DOMAIN,
  ACCESS_AUD: AUDIENCE,
  ACCESS_ALLOWED_EMAILS: OWNER_EMAIL,
} satisfies Partial<Env>;

export async function createSigningIdentity(kid: string): Promise<SigningIdentity> {
  const pair = (await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const publicJwk = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey;
  return { kid, privateKey: pair.privateKey, publicJwk: { ...publicJwk, kid, alg: "RS256", use: "sig" } };
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/gu, "-")
    .replace(/\//gu, "_")
    .replace(/=+$/u, "");
}

function encodeJson(value: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

export async function signAccessJwt(
  identity: SigningIdentity,
  claims: Record<string, unknown> = {},
  header: Record<string, unknown> = {},
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const encoded = [
    encodeJson({ alg: "RS256", kid: identity.kid, typ: "JWT", ...header }),
    encodeJson({
      iss: `https://${TEAM_DOMAIN}`,
      aud: [AUDIENCE],
      email: OWNER_EMAIL,
      sub: "owner-user-id",
      type: "app",
      iat: now,
      nbf: now,
      exp: now + 3600,
      ...claims,
    }),
  ].join(".");
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    identity.privateKey,
    new TextEncoder().encode(encoded),
  );
  return `${encoded}.${base64Url(new Uint8Array(signature))}`;
}

export function serveAccessCerts(...identities: SigningIdentity[]) {
  const certsUrl = `https://${TEAM_DOMAIN}/cdn-cgi/access/certs`;
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url !== certsUrl) return new Response("Unexpected request", { status: 404 });
    return Response.json({ keys: identities.map((identity) => identity.publicJwk) });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
