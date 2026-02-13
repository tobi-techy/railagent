import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { buildApp } from "../src/index.js";
import { SqliteTransferStore } from "../src/store.js";
import { hashApiKey } from "../src/security.js";

function tempDbPath(tag: string): string {
  return path.join(os.tmpdir(), `railagent-${tag}-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`);
}

test("create/list/revoke lifecycle + active accepted revoked rejected", async () => {
  const dbPath = tempDbPath("auth-lifecycle");
  const app = buildApp({
    dbPath,
    env: {
      ...process.env,
      API_ADMIN_TOKEN: "admin_secret",
      RATE_LIMIT_PER_MIN: "1000"
    }
  });
  await app.ready();

  const created = await app.inject({
    method: "POST",
    url: "/auth/keys",
    headers: { "x-admin-token": "admin_secret" },
    payload: { developerId: "dev_a", label: "primary" }
  });
  assert.equal(created.statusCode, 201);
  const createdBody = created.json() as any;
  assert.ok(createdBody.rawKey);
  assert.equal(createdBody.key.developerId, "dev_a");

  const listed = await app.inject({
    method: "GET",
    url: "/auth/keys?developerId=dev_a",
    headers: { "x-admin-token": "admin_secret" }
  });
  assert.equal(listed.statusCode, 200);
  const listBody = listed.json() as any;
  assert.equal(listBody.keys.length, 1);

  const transferOk = await app.inject({
    method: "POST",
    url: "/transfer",
    headers: {
      "x-api-key": createdBody.rawKey,
      "idempotency-key": "idem_dev_a_1"
    },
    payload: { quoteId: "qt_1", recipient: "maria", amount: "10", fromToken: "USD", toToken: "PHP" }
  });
  assert.equal(transferOk.statusCode, 200);

  const revoked = await app.inject({
    method: "POST",
    url: `/auth/keys/${createdBody.key.id}/revoke`,
    headers: { "x-admin-token": "admin_secret" }
  });
  assert.equal(revoked.statusCode, 200);

  const transferRejected = await app.inject({
    method: "POST",
    url: "/transfer",
    headers: {
      "x-api-key": createdBody.rawKey,
      "idempotency-key": "idem_dev_a_2"
    },
    payload: { quoteId: "qt_2", recipient: "maria", amount: "10", fromToken: "USD", toToken: "PHP" }
  });
  assert.equal(transferRejected.statusCode, 401);

  await app.close();
  fs.rmSync(dbPath, { force: true });
});

test("raw key is not persisted and developer-specific rate limit identity works", async () => {
  const dbPath = tempDbPath("auth-rate");
  const app = buildApp({
    dbPath,
    env: {
      ...process.env,
      API_ADMIN_TOKEN: "admin_secret",
      RATE_LIMIT_PER_MIN: "1000"
    }
  });
  await app.ready();

  const created = await app.inject({
    method: "POST",
    url: "/auth/keys",
    headers: { "x-admin-token": "admin_secret" },
    payload: { developerId: "dev_rl", label: "rl", rateLimitPerMin: 1 }
  });
  const body = created.json() as any;

  const store = new SqliteTransferStore(dbPath);
  const row = store.getRawDeveloperApiKeyRowForTest(body.key.id);
  assert.equal(row.key_hash, hashApiKey(body.rawKey));
  assert.notEqual(row.key_hash, body.rawKey);

  const firstWebhook = await app.inject({
    method: "POST",
    url: "/webhooks/register",
    headers: { "x-api-key": body.rawKey },
    payload: { url: "https://example.com/a" }
  });
  assert.equal(firstWebhook.statusCode, 201);

  const secondWebhook = await app.inject({
    method: "POST",
    url: "/webhooks/register",
    headers: { "x-api-key": body.rawKey },
    payload: { url: "https://example.com/b" }
  });
  assert.equal(secondWebhook.statusCode, 429);

  await app.close();
  fs.rmSync(dbPath, { force: true });
});
