# API examples (Postman / HTTP)

Base URL: `http://localhost:3000`

## 1) Parse intent (AI + fallback)

```bash
curl -X POST http://localhost:3000/intent/parse \
  -H 'content-type: application/json' \
  -d '{"text":"Send 120 USD to maria in Manila and convert to PHP"}'
```

## 2) Quote route

```bash
curl -X POST http://localhost:3000/quote \
  -H 'content-type: application/json' \
  -d '{"fromToken":"USD","toToken":"PHP","amount":"120","destinationChain":"celo"}'
```

## 3) Execute transfer (write-protected)

```bash
curl -X POST http://localhost:3000/transfer \
  -H 'content-type: application/json' \
  -H 'x-api-key: dev_write_key' \
  -H 'Idempotency-Key: idem_120_usd_php' \
  -d '{"quoteId":"qt_demo_001","recipient":"maria","amount":"120","fromToken":"USD","toToken":"PHP"}'
```

## 4) Register webhook (write-protected)

```bash
curl -X POST http://localhost:3000/webhooks/register \
  -H 'content-type: application/json' \
  -H 'x-api-key: dev_write_key' \
  -d '{"url":"https://example.com/webhooks/railagent"}'
```

## 5) Verify webhook signature / replay window

```bash
curl -X POST http://localhost:3000/webhooks/verify \
  -H 'content-type: application/json' \
  -d '{"payload":"{\"id\":\"evt_1\"}","timestamp":"1700000000","signature":"<hex>"}'
```

## Error taxonomy snapshot

- `VALIDATION_ERROR` – malformed payloads
- `UNAUTHORIZED` – missing/invalid API key
- `RATE_LIMITED` – request burst above configured threshold
- `POLICY_VIOLATION` – transfer denied by policy controls
- `TRANSFER_NOT_FOUND` – unknown transfer id
- `INTERNAL_ERROR` – unexpected failure
