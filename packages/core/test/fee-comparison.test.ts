import test from "node:test";
import assert from "node:assert/strict";
import { compareRemittanceFees } from "../src/index.js";

test("computes savings for known corridor", () => {
  const result = compareRemittanceFees({ sourceCurrency: "USD", targetCurrency: "PHP", amount: 120, railAgentFeeUsd: 0.11 });
  assert.equal(result.corridor, "USD->PHP");
  assert.ok(result.savingsUsd > 0);
  assert.ok(result.savingsPct > 0);
});

test("falls back to default baseline for unknown corridor", () => {
  const result = compareRemittanceFees({ sourceCurrency: "CAD", targetCurrency: "MXN", amount: 100, railAgentFeeUsd: 0.2 });
  assert.equal(result.corridor, "CAD->MXN");
  assert.equal(result.legacy.length, 2);
  assert.match(result.disclaimer, /estimates/i);
});
