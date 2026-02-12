import test from "node:test";
import assert from "node:assert/strict";
import { runAgentFlow, type DemoAgentClient } from "../src/flow.js";

function createMockClient(overrides?: Partial<DemoAgentClient>): DemoAgentClient {
  return {
    async parseIntent() {
      return {
        intent: "transfer",
        confidence: 0.9,
        extracted: {
          parsed: {
            amount: 100,
            sourceCurrency: "USD",
            targetCurrency: "PHP",
            recipient: "maria"
          },
          needsClarification: false,
          clarificationQuestions: []
        }
      };
    },
    async quote() {
      return {
        bestRoute: { route: "celo->mento->gcash", estimatedReceive: "5600.000000", fee: "0.11", etaSeconds: 42 },
        alternatives: [
          { route: "celo->mento->gcash", estimatedReceive: "5600.000000", fee: "0.11", etaSeconds: 42 },
          { route: "celo->bridge-x->gcash", estimatedReceive: "5580.000000", fee: "0.20", etaSeconds: 55 }
        ]
      };
    },
    async transfer() {
      return {
        id: "tr_idem_123",
        status: "submitted"
      };
    },
    ...overrides
  };
}

test("returns clarification questions when parser needs clarification", async () => {
  const client = createMockClient({
    async parseIntent() {
      return {
        intent: "transfer",
        confidence: 0.5,
        extracted: {
          parsed: {},
          needsClarification: true,
          clarificationQuestions: ["What amount do you want to transfer?"]
        }
      };
    }
  });

  const result = await runAgentFlow(client, "send money", { confirm: true });

  assert.equal(result.executed, false);
  assert.equal(result.needsConfirmation, false);
  assert.match(result.lines.join("\n"), /What amount do you want to transfer\?/);
});

test("quote-only mode does not execute transfer", async () => {
  let transferCalled = false;
  const client = createMockClient({
    async transfer() {
      transferCalled = true;
      return { id: "tr_idem_123", status: "submitted" };
    }
  });

  const result = await runAgentFlow(client, "send 100 usd to php to maria", { confirm: false });

  assert.equal(transferCalled, false);
  assert.equal(result.executed, false);
  assert.equal(result.needsConfirmation, true);
  assert.match(result.lines.join("\n"), /Confirmation required/);
});

test("confirm mode executes transfer and prints final status", async () => {
  let transferCalled = false;
  const client = createMockClient({
    async transfer() {
      transferCalled = true;
      return { id: "tr_abc", status: "submitted" };
    }
  });

  const result = await runAgentFlow(client, "send 100 usd to php to maria", { confirm: true });

  assert.equal(transferCalled, true);
  assert.equal(result.executed, true);
  assert.match(result.lines.join("\n"), /transferId=tr_abc/);
});
