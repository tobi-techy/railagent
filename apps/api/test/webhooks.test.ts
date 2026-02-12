import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { WebhookDispatcher } from "../src/webhooks.js";

test("generates deterministic webhook signature", () => {
  const dispatcher = new WebhookDispatcher("secret_123");
  const payload = JSON.stringify({ id: "evt_1", type: "transfer.submitted" });

  const ts = "1700000000";
  const expected = crypto.createHmac("sha256", "secret_123").update(`${ts}.${payload}`).digest("hex");
  assert.equal(dispatcher.signPayload(payload, ts), expected);

  dispatcher.stop();
});
