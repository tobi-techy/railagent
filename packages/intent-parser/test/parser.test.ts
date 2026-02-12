import test from "node:test";
import assert from "node:assert/strict";
import { parseIntent } from "../src/index.js";

test("parses English transfer request", () => {
  const result = parseIntent("Send 120 USD to maria in Manila and convert to PHP");
  assert.equal(result.intent, "transfer");
  assert.equal(result.parsed.language, "en");
  assert.equal(result.parsed.amount, 120);
  assert.equal(result.parsed.sourceCurrency, "USD");
  assert.equal(result.parsed.targetCurrency, "PHP");
  assert.equal(result.parsed.destinationHint, "Philippines");
  assert.equal(result.needsClarification, false);
});

test("parses Spanish transfer request", () => {
  const result = parseIntent("Quiero enviar 50 EUR para jose en Nigeria a NGN");
  assert.equal(result.intent, "transfer");
  assert.equal(result.parsed.language, "es");
  assert.equal(result.parsed.amount, 50);
  assert.equal(result.parsed.sourceCurrency, "EUR");
  assert.equal(result.parsed.targetCurrency, "NGN");
});

test("parses Portuguese transfer request", () => {
  const result = parseIntent("Preciso transferir 75 GBP para ana no Kenya em KES");
  assert.equal(result.intent, "transfer");
  assert.equal(result.parsed.language, "pt");
  assert.equal(result.parsed.amount, 75);
  assert.equal(result.parsed.sourceCurrency, "GBP");
  assert.equal(result.parsed.targetCurrency, "KES");
});

test("parses French quote request", () => {
  const result = parseIntent("Peux-tu me donner un devis de 200 EUR vers NGN?");
  assert.equal(result.intent, "quote");
  assert.equal(result.parsed.language, "fr");
  assert.equal(result.parsed.amount, 200);
  assert.equal(result.parsed.sourceCurrency, "EUR");
  assert.equal(result.parsed.targetCurrency, "NGN");
});

test("asks clarification when key fields are missing", () => {
  const result = parseIntent("send money");
  assert.equal(result.intent, "transfer");
  assert.equal(result.needsClarification, true);
  assert.ok(result.clarificationQuestions.length > 0);
  assert.ok(result.confidence < 0.8);
});
