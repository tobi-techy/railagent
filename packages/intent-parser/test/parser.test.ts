import test from "node:test";
import assert from "node:assert/strict";
import { parseIntent, parseIntentWithProvider } from "../src/index.js";

test("parses noisy English typo transfer", () => {
  const result = parseIntent("pls sned 120 usd to my mom maria in manila to php every month");
  assert.equal(result.intent, "transfer");
  assert.equal(result.parsed.amount, 120);
  assert.equal(result.parsed.sourceCurrency, "USD");
  assert.equal(result.parsed.targetCurrency, "PHP");
  assert.equal(result.parsed.recurringCadence, "monthly");
  assert.ok(result.parsed.recipientRelation);
});

test("parses noisy Spanish transfer", () => {
  const result = parseIntent("quiero enivar 50 eur para mi hermano jose en lagos a ngn mensual");
  assert.equal(result.intent, "transfer");
  assert.equal(result.parsed.language, "es");
  assert.equal(result.parsed.amount, 50);
  assert.equal(result.parsed.sourceCurrency, "EUR");
  assert.equal(result.parsed.targetCurrency, "NGN");
});

test("parses noisy Portuguese transfer", () => {
  const result = parseIntent("preciso tranfser 75 gbp para minha mae ana no kenya em kes mensal");
  assert.equal(result.intent, "transfer");
  assert.equal(result.parsed.language, "pt");
  assert.equal(result.parsed.amount, 75);
  assert.equal(result.parsed.sourceCurrency, "GBP");
  assert.equal(result.parsed.targetCurrency, "KES");
});

test("parses noisy French quote", () => {
  const result = parseIntent("donne moi un deivs pour 200 eur vers ngn");
  assert.equal(result.intent, "quote");
  assert.equal(result.parsed.language, "fr");
  assert.equal(result.parsed.amount, 200);
});

test("gemini invalid structured output falls back to deterministic parser", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text: "{\"not_schema\":true}" }] } }] }),
      { status: 200 }
    ) as any;

  const result = await parseIntentWithProvider("send 100 usd to php to maria", {
    provider: "gemini",
    geminiApiKey: "dummy"
  });

  assert.equal(result.provider, "deterministic");
  assert.equal(typeof result.fallbackReason, "string");
  globalThis.fetch = originalFetch;
});
