import test from "node:test";
import assert from "node:assert/strict";
import { ApiError, assertApiKey, enforceRateLimit, verifyWebhookSignature } from "../src/security.js";

test("api key middleware rejects missing key", () => {
  assert.throws(
    () => assertApiKey({ headers: {} } as any, ["k1"]),
    (error: any) => error instanceof ApiError && error.code === "UNAUTHORIZED"
  );
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
