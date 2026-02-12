import test from "node:test";
import assert from "node:assert/strict";
import { parseIntentWithProvider } from "../src/index.js";

test("falls back to deterministic parser when gemini key is missing", async () => {
  const result = await parseIntentWithProvider("send 100 usd to php to maria", {
    provider: "gemini",
    geminiApiKey: undefined
  });

  assert.equal(result.provider, "deterministic");
  assert.equal(result.intent, "transfer");
});

test("openclaw provider falls back deterministically when unavailable", async () => {
  const result = await parseIntentWithProvider("quote 50 eur to ngn", {
    provider: "openclaw"
  });

  assert.equal(result.provider, "deterministic");
  assert.equal(typeof result.fallbackReason, "string");
});
