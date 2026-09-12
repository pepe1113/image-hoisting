import assert from "node:assert/strict";
import console from "node:console";
import process from "node:process";
import { URL } from "node:url";

const EXPECTED_SERVICE = "r2-image-api";

function validatePayload(payload) {
  if (payload?.data?.status !== "ok" || payload.data.service !== EXPECTED_SERVICE) {
    throw new Error("Health check returned an unexpected payload");
  }
}

async function checkHealth(baseUrl, request = globalThis.fetch) {
  if (!baseUrl) throw new Error("PRODUCTION_BASE_URL is required");

  const url = new URL("/health", baseUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("PRODUCTION_BASE_URL must use HTTP or HTTPS");
  }

  const response = await request(url, {
    headers: { accept: "application/json" },
    signal: globalThis.AbortSignal.timeout(10_000),
  });

  if (!response.ok) throw new Error(`Health check failed with HTTP ${response.status}`);

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Health check returned invalid JSON");
  }
  validatePayload(payload);
}

async function selfTest() {
  const request = async (url, init) => {
    assert.equal(url.href, "https://example.com/health");
    assert.ok(init.signal);
    return new globalThis.Response(
      JSON.stringify({ data: { status: "ok", service: EXPECTED_SERVICE } }),
      {
        headers: { "content-type": "application/json" },
      },
    );
  };

  await checkHealth("https://example.com/anything", request);
  await assert.rejects(
    checkHealth("https://example.com", async () => new globalThis.Response(null, { status: 503 })),
    /HTTP 503/,
  );
  assert.throws(() => validatePayload({ data: { status: "ok", service: "wrong-service" } }));
}

try {
  if (process.argv.includes("--self-test")) {
    await selfTest();
    console.log("Health smoke self-test passed");
  } else {
    await checkHealth(process.env.PRODUCTION_BASE_URL);
    console.log("Production health smoke test passed");
  }
} catch (error) {
  console.error(`Health smoke test failed: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
}
