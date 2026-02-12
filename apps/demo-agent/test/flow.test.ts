import test from "node:test";
import assert from "node:assert/strict";
import { runAgentFlow, type DemoAgentClient } from "../src/flow.js";

function createMockClient(overrides?: Partial<DemoAgentClient>): DemoAgentClient {
  return {
    async agentMessage() {
      return {
        assistantResponse: "Plan ready. Confirm to execute.",
        actionState: "quoted",
        confidence: 0.9,
        quote: { bestRoute: { route: "celo->mento->gcash", estimatedReceive: "5600.000000", fee: "0.11", etaSeconds: 42 } },
        comparison: { savingsUsd: 6.5, savingsPct: 82, disclaimer: "estimate" }
      };
    },
    ...overrides
  };
}

test("returns clarification response when agent asks for more info", async () => {
  const client = createMockClient({
    async agentMessage() {
      return { assistantResponse: "What amount should I send?", actionState: "clarify", confidence: 0.5 } as any;
    }
  });

  const result = await runAgentFlow(client, "send money", { confirm: false, sessionId: "s1" });
  assert.equal(result.executed, false);
  assert.equal(result.needsConfirmation, false);
  assert.match(result.lines.join("\n"), /What amount/);
});

test("quoted response requires confirmation", async () => {
  const client = createMockClient();
  const result = await runAgentFlow(client, "sned 100 usd to mom", { confirm: false, sessionId: "s1" });
  assert.equal(result.executed, false);
  assert.equal(result.needsConfirmation, true);
});

test("keeps session id for follow-up turns", async () => {
  const seen: string[] = [];
  const client = createMockClient({
    async agentMessage(payload) {
      seen.push(payload.sessionId);
      return { assistantResponse: "ok", actionState: "clarify", confidence: 0.7 } as any;
    }
  });

  await runAgentFlow(client, "send 100 usd to maria", { confirm: false, sessionId: "thread-1" });
  await runAgentFlow(client, "make it monthly", { confirm: false, sessionId: "thread-1" });
  assert.deepEqual(seen, ["thread-1", "thread-1"]);
});

test("confirm mode executes transfer", async () => {
  const client = createMockClient({
    async agentMessage() {
      return {
        assistantResponse: "Transfer submitted",
        actionState: "executed",
        confidence: 0.95,
        transfer: { id: "tr_abc", status: "submitted" }
      } as any;
    }
  });

  const result = await runAgentFlow(client, "send it", { confirm: true, sessionId: "s1" });
  assert.equal(result.executed, true);
  assert.match(result.lines.join("\n"), /tr_abc/);
});
