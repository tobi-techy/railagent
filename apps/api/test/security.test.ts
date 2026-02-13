import test from "node:test";
import assert from "node:assert/strict";
import {
  ApiError,
  enforceRateLimit,
  hashApiKey,
  resolveWriteAuth,
  verifyWebhookSignature
} from "../src/security.js";

test("resolveWriteAuth rejects missing key", () => {
  assert.throws(
    () => resolveWriteAuth({ headers: {} } as any, {
      legacyApiKeys: ["k1"],
      findDeveloperKeyByHash: () => undefined,
      touchDeveloperKeyLastUsed: () => undefined
    }),
    (error: any) => error instanceof ApiError && error.code === "UNAUTHORIZED"
  );
});

test("resolveWriteAuth accepts legacy key", () => {
  const auth = resolveWriteAuth({ headers: { "x-api-key": "legacy_1" } } as any, {
    legacyApiKeys: ["legacy_1"],
    findDeveloperKeyByHash: () => undefined,
    touchDeveloperKeyLastUsed: () => undefined
  });
  assert.equal(auth.source, "legacy");
  assert.equal(auth.developerId, "legacy");
});

test("resolveWriteAuth accepts developer key", () => {
  const raw = "rk_live_abc";
  const auth = resolveWriteAuth({ headers: { "x-api-key": raw } } as any, {
    legacyApiKeys: [],
    findDeveloperKeyByHash: (keyHash) => keyHash === hashApiKey(raw)
      ? { id: "dak_1", developerId: "dev_1", keyPrefix: "rk_live_abc", status: "active", rateLimitPerMin: 5 }
      : undefined,
    touchDeveloperKeyLastUsed: () => undefined
  });
  assert.equal(auth.source, "developer");
  assert.equal(auth.developerId, "dev_1");
  assert.equal(auth.rateLimitPerMin, 5);
});

test("rate limiter blocks after threshold", () => {
  const first = enforceRateLimit("ip:1", 2, 10_000);
  const second = enforceRateLimit("ip:1", 2, 10_000);
  const third = enforceRateLimit("ip:1", 2, 10_000);

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(third.allowed, false);
});

test("webhook signature verification checks timestamp + signature", async () => {
  const ts = `${Math.floor(Date.now() / 1000)}`;
  const payload = JSON.stringify({ id: "evt_1" });
  const secret = "secret_123";
  const crypto = await import("node:crypto");
  const signature = crypto.createHmac("sha256", secret).update(`${ts}.${payload}`).digest("hex");

  const ok = verifyWebhookSignature({ secret, payload, signature, timestamp: ts });
  assert.equal(ok.ok, true);

  const bad = verifyWebhookSignature({ secret, payload, signature: "bad", timestamp: ts });
  assert.equal(bad.ok, false);
});
