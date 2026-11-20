import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { handleRequest } from "../src";
import type { Env } from "../src/types";
import {
  ACCESS_ENV,
  AUDIENCE,
  createSigningIdentity,
  OWNER_EMAIL,
  serveAccessCerts,
  signAccessJwt,
  TEAM_DOMAIN,
  type SigningIdentity,
} from "./access-token";

const emptyBucket = { get: async () => null, head: async () => null } as unknown as R2Bucket;

let primary: SigningIdentity;
let rotated: SigningIdentity;
let stranger: SigningIdentity;

beforeAll(async () => {
  [primary, rotated, stranger] = await Promise.all([
    createSigningIdentity("primary"),
    createSigningIdentity("rotated"),
    createSigningIdentity("stranger"),
  ]);
});

beforeEach(() => {
  serveAccessCerts(primary);
});

function env(access: Partial<Env> = ACCESS_ENV): Env {
  return { IMAGES: emptyBucket, PUBLIC_BASE_URL: "https://img.example.com", ...access };
}

function profilesRequest(token?: string, origin = "https://images.example.com"): Request {
  return new Request(`${origin}/api/profiles`, {
    headers: token ? { "Cf-Access-Jwt-Assertion": token } : {},
  });
}

async function expectRejected(response: Response, reason: string): Promise<void> {
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({
    error: { code: "UNAUTHORIZED", message: `Cloudflare Access rejected this request: ${reason}` },
  });
}

async function expectNotConfigured(response: Response): Promise<void> {
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ error: { code: "AUTH_NOT_CONFIGURED" } });
}

describe("Cloudflare Access verification", () => {
  it("accepts a valid Access token for an allowed email", async () => {
    const response = await handleRequest(profilesRequest(await signAccessJwt(primary)), env());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: [{ id: "default" }] });
  });

  it("matches allowed emails without regard to case or spacing", async () => {
    const response = await handleRequest(
      profilesRequest(await signAccessJwt(primary, { email: "Owner@Example.com" })),
      env({ ...ACCESS_ENV, ACCESS_ALLOWED_EMAILS: " someone@example.com , OWNER@example.com " }),
    );
    expect(response.status).toBe(200);
  });

  it("accepts a string audience claim", async () => {
    const response = await handleRequest(
      profilesRequest(await signAccessJwt(primary, { aud: AUDIENCE })),
      env(),
    );
    expect(response.status).toBe(200);
  });

  it("rejects a request without the Access header", async () => {
    await expectRejected(await handleRequest(profilesRequest(), env()), "missing token");
  });

  it("rejects a token signed by a different key under a known key ID", async () => {
    const forged = await signAccessJwt({ ...stranger, kid: primary.kid });
    await expectRejected(await handleRequest(profilesRequest(forged), env()), "invalid signature");
  });

  it("rejects a token whose key ID Access never published", async () => {
    const certs = serveAccessCerts(primary);
    const token = await signAccessJwt(stranger);
    await expectRejected(await handleRequest(profilesRequest(token), env()), "unknown signing key");
    expect(certs).toHaveBeenCalledWith(`https://${TEAM_DOMAIN}/cdn-cgi/access/certs`);
  });

  it("refetches the Access certs when a token uses a newly rotated key", async () => {
    expect((await handleRequest(profilesRequest(await signAccessJwt(primary)), env())).status).toBe(200);
    serveAccessCerts(primary, rotated);
    const response = await handleRequest(profilesRequest(await signAccessJwt(rotated)), env());
    expect(response.status).toBe(200);
  });

  it("rejects unsigned tokens", async () => {
    const token = await signAccessJwt(primary, {}, { alg: "none" });
    await expectRejected(await handleRequest(profilesRequest(token), env()), "unsupported algorithm");
  });

  it("rejects a malformed token", async () => {
    await expectRejected(await handleRequest(profilesRequest("not-a-jwt"), env()), "malformed token");
  });

  it("rejects an expired token", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signAccessJwt(primary, { iat: now - 7200, nbf: now - 7200, exp: now - 60 });
    await expectRejected(await handleRequest(profilesRequest(token), env()), "token expired");
  });

  it("rejects a token that is not valid yet", async () => {
    const token = await signAccessJwt(primary, { nbf: Math.floor(Date.now() / 1000) + 600 });
    await expectRejected(await handleRequest(profilesRequest(token), env()), "token not yet valid");
  });

  it("rejects a token issued for another Access application", async () => {
    const token = await signAccessJwt(primary, { aud: ["another-application"] });
    await expectRejected(await handleRequest(profilesRequest(token), env()), "wrong audience");
  });

  it("rejects a token issued by another team", async () => {
    const token = await signAccessJwt(primary, { iss: "https://other-team.cloudflareaccess.com" });
    await expectRejected(await handleRequest(profilesRequest(token), env()), "wrong issuer");
  });

  it("rejects an email outside the allowlist", async () => {
    const token = await signAccessJwt(primary, { email: "visitor@example.com" });
    await expectRejected(await handleRequest(profilesRequest(token), env()), "email not allowed");
  });
});

describe("Access configuration", () => {
  it("signs local development requests in as ACCESS_DEV_EMAIL", async () => {
    const response = await handleRequest(
      profilesRequest(undefined, "http://localhost:8787"),
      env({ ACCESS_DEV_EMAIL: OWNER_EMAIL }),
    );
    expect(response.status).toBe(200);
  });

  it("refuses the development login outside localhost", async () => {
    await expectNotConfigured(await handleRequest(
      profilesRequest(),
      env({ ACCESS_DEV_EMAIL: OWNER_EMAIL }),
    ));
  });

  it("fails closed when the development login is set alongside Access", async () => {
    await expectNotConfigured(await handleRequest(
      profilesRequest(await signAccessJwt(primary), "http://localhost:8787"),
      env({ ...ACCESS_ENV, ACCESS_DEV_EMAIL: OWNER_EMAIL }),
    ));
  });

  it("fails closed when nothing is configured", async () => {
    await expectNotConfigured(await handleRequest(profilesRequest(), env({})));
  });

  it("fails closed when the empty placeholder values are deployed", async () => {
    await expectNotConfigured(await handleRequest(
      profilesRequest(),
      env({ ACCESS_TEAM_DOMAIN: "", ACCESS_AUD: "", ACCESS_ALLOWED_EMAILS: "", ACCESS_DEV_EMAIL: "" }),
    ));
  });

  it("fails closed when Access is missing its audience or allowlist", async () => {
    const token = await signAccessJwt(primary);
    await expectNotConfigured(await handleRequest(profilesRequest(token), env({ ...ACCESS_ENV, ACCESS_AUD: " " })));
    await expectNotConfigured(await handleRequest(
      profilesRequest(token),
      env({ ...ACCESS_ENV, ACCESS_ALLOWED_EMAILS: " , " }),
    ));
  });

  it("accepts a team domain pasted as a URL", async () => {
    const response = await handleRequest(
      profilesRequest(await signAccessJwt(primary)),
      env({ ...ACCESS_ENV, ACCESS_TEAM_DOMAIN: `https://${TEAM_DOMAIN}/` }),
    );
    expect(response.status).toBe(200);
  });

  it("serves public routes without authentication or configuration", async () => {
    const publicEnv = env({});
    expect((await handleRequest(new Request("https://images.example.com/health"), publicEnv)).status).toBe(200);
    for (const path of ["/images/missing.webp", "/profile-images/default/missing.webp"]) {
      const response = await handleRequest(new Request(`https://images.example.com${path}`), publicEnv);
      expect(response.status).toBe(404);
    }
  });
});
