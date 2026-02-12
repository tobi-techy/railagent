import test from "node:test";
import assert from "node:assert/strict";
import { createMentoProviders } from "../src/index.js";

test("defaults to mock provider", () => {
  const { quoteProvider, executionProvider, fallbackReason } = createMentoProviders({});
  assert.equal(quoteProvider.mode, "mock");
  assert.equal(executionProvider.mode, "mock");
  assert.equal(fallbackReason, undefined);
});

test("falls back to mock when live provider is not configured", () => {
  const { quoteProvider, executionProvider, fallbackReason } = createMentoProviders({
    MENTO_PROVIDER_MODE: "live"
  });

  assert.equal(quoteProvider.mode, "mock");
  assert.equal(executionProvider.mode, "mock");
  assert.equal(typeof fallbackReason, "string");
  assert.equal(fallbackReason?.includes("MENTO_RPC_URL"), true);
});
