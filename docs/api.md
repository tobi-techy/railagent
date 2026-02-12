# API examples (Postman / HTTP)

Base URL: `http://localhost:3000`

## 1) Natural-language conversation (recommended)

```bash
curl -X POST http://localhost:3000/agent/message \
  -H 'content-type: application/json' \
  -d '{"sessionId":"judge-1","text":"sned 120 usd to my mom in manila to php every month","confirm":false}'
```

Follow-up in same session memory:

```bash
curl -X POST http://localhost:3000/agent/message \
  -H 'content-type: application/json' \
  -d '{"sessionId":"judge-1","text":"use the cheapest option"}'
```

Confirm execution:

```bash
curl -X POST http://localhost:3000/agent/message \
  -H 'content-type: application/json' \
  -d '{"sessionId":"judge-1","text":"yes, send it now","confirm":true}'
```

## 2) Parse intent (backward compatibility)

```bash
curl -X POST http://localhost:3000/intent/parse \
  -H 'content-type: application/json' \
  -d '{"text":"Send 120 USD to maria in Manila and convert to PHP"}'
```

## 3) Quote route (+ comparison)

```bash
curl -X POST http://localhost:3000/quote \
  -H 'content-type: application/json' \
  -d '{"fromToken":"USD","toToken":"PHP","amount":"120","destinationChain":"celo"}'
```

## 4) Execute transfer (write-protected)

```bash
curl -X POST http://localhost:3000/transfer \
  -H 'content-type: application/json' \
  -H 'x-api-key: dev_write_key' \
  -H 'Idempotency-Key: idem_120_usd_php' \
  -d '{"quoteId":"qt_demo_001","recipient":"maria","amount":"120","fromToken":"USD","toToken":"PHP"}'
```

## 5) Register webhook

```bash
curl -X POST http://localhost:3000/webhooks/register \
  -H 'content-type: application/json' \
  -H 'x-api-key: dev_write_key' \
  -d '{"url":"https://example.com/webhooks/railagent"}'
```

## Notes for judging criteria

- NL-first UX: handled via `/agent/message`
- conversation memory: persisted by `sessionId`
- multilingual + typo tolerance: parser supports EN/ES/PT/FR noisy text
- fee comparison: quote and agent responses include RailAgent vs WU/Wise-style baseline savings
- disclaimer: comparisons are estimates, not live third-party quotes
