import test from "node:test";
import assert from "node:assert/strict";
import { scoreRoutes } from "../src/index.js";

test("selects best route for USD->PHP corridor", () => {
  const result = scoreRoutes({ sourceCurrency: "USD", targetCurrency: "PHP", amount: 100 });
  assert.equal(result.bestRoute.candidate.id, "r1");
  assert.equal(result.explanation.corridor, "USD->PHP");
  assert.equal(result.alternatives.length, 3);
});

test("selects best route for EUR->NGN corridor", () => {
  const result = scoreRoutes({ sourceCurrency: "EUR", targetCurrency: "NGN", amount: 100 });
  assert.equal(result.bestRoute.candidate.id, "r4");
  assert.equal(result.alternatives[0].score >= result.alternatives[1].score, true);
});

test("selects best route for GBP->KES corridor", () => {
  const result = scoreRoutes({ sourceCurrency: "GBP", targetCurrency: "KES", amount: 100 });
  assert.equal(result.bestRoute.candidate.id, "r7");
  assert.equal(result.alternatives[0].candidate.route, "celo->mento->mpesa");
});
