import test from "node:test";
import assert from "node:assert/strict";
import { evaluateTransferPolicy } from "../src/policy.js";

test("policy passes for valid transfer", () => {
  const decision = evaluateTransferPolicy(
    {
      amount: 100,
      fromToken: "USD",
      toToken: "PHP",
      recipient: "maria",
      idempotencyKey: "idem_123"
    },
    {
      maxAmount: 1000,
      allowedCorridors: ["USD->PHP"],
      requireRecipient: true,
      requireIdempotencyKey: true
    }
  );

  assert.equal(decision.allowed, true);
  assert.equal(decision.violations.length, 0);
});

test("policy fails for missing required fields", () => {
  const decision = evaluateTransferPolicy(
    {
      amount: 10,
      fromToken: "USD",
      toToken: "PHP"
    },
    {
      maxAmount: 1000,
      allowedCorridors: ["USD->PHP"],
      requireRecipient: true,
      requireIdempotencyKey: true
    }
  );

  assert.equal(decision.allowed, false);
  assert.deepEqual(
    decision.violations.map((v) => v.code).sort(),
    ["POLICY_IDEMPOTENCY_KEY_REQUIRED", "POLICY_RECIPIENT_REQUIRED"].sort()
  );
});

test("policy fails when amount exceeds max or corridor disallowed", () => {
  const decision = evaluateTransferPolicy(
    {
      amount: 5000,
      fromToken: "USD",
      toToken: "KES",
      recipient: "anne",
      idempotencyKey: "idem_abc"
    },
    {
      maxAmount: 1000,
      allowedCorridors: ["USD->PHP"],
      requireRecipient: true,
      requireIdempotencyKey: true
    }
  );

  assert.equal(decision.allowed, false);
  assert.equal(decision.violations.some((v) => v.code === "POLICY_MAX_AMOUNT_EXCEEDED"), true);
  assert.equal(decision.violations.some((v) => v.code === "POLICY_CORRIDOR_NOT_ALLOWED"), true);
});
