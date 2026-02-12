# RailAgent API

Base URL (local): `http://localhost:3000`

## GET /health

Returns service health.

## POST /intent/parse

Deterministic multilingual intent parsing (EN/ES/PT/FR) with confidence and clarification prompts.

## POST /quote

Weighted route optimization for supported corridors (`USD->PHP`, `EUR->NGN`, `GBP->KES`) with transparent scoring breakdown.

## POST /transfer

Creates a transfer after policy checks and returns provider metadata.

### Headers

- `Idempotency-Key` (required)

### Request

```json
{
  "quoteId": "qt_123",
  "recipient": "maria",
  "amount": "100",
  "fromToken": "USD",
  "toToken": "PHP"
}
```

### Success response

```json
{
  "id": "tr_idem_001",
  "status": "submitted",
  "policyDecision": {
    "allowed": true,
    "violations": []
  },
  "provider": {
    "name": "mock-mento",
    "mode": "mock"
  }
}
```

### Policy denial response

```json
{
  "error": "Transfer policy denied",
  "code": "POLICY_VIOLATION",
  "policyDecision": {
    "allowed": false,
    "violations": [
      {
        "code": "POLICY_IDEMPOTENCY_KEY_REQUIRED",
        "message": "Idempotency key is required",
        "field": "idempotencyKey"
      }
    ]
  }
}
```

## GET /transfers/:id

Returns transfer status from in-memory store.

## POST /webhooks/register

Registers a webhook target (in-memory).

### Request

```json
{
  "url": "https://example.com/webhooks/railagent"
}
```

### Response

```json
{
  "webhook": {
    "id": "wh_ab12cd34",
    "url": "https://example.com/webhooks/railagent",
    "createdAt": "2026-01-01T00:00:00.000Z"
  }
}
```

## GET /webhooks

Returns all registered webhook targets.

## Webhook delivery

RailAgent emits transfer lifecycle events:

- `transfer.submitted`
- `transfer.settled`
- `transfer.failed` (reserved)

Headers sent with each webhook:

- `x-railagent-event`
- `x-railagent-signature` (hex HMAC-SHA256)

### Signature verification example (Node.js)

```ts
import crypto from "node:crypto";

const secret = process.env.WEBHOOK_SECRET!;
const rawBody = requestBodyAsRawString;
const signature = incomingHeaders["x-railagent-signature"];

const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

if (signature !== expected) {
  throw new Error("Invalid webhook signature");
}
```

Retries use in-memory backoff for MVP (1s, 3s, 7s).
