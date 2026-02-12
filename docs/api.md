# RailAgent API

Base URL (local): `http://localhost:3000`

## GET /health

Returns service health.

## POST /intent/parse

Deterministic multilingual intent parsing (EN/ES/PT/FR) with confidence and clarification prompts.

**Request**

```json
{
  "text": "Envoyer 200 EUR vers NGN pour ade"
}
```

**Response**

```json
{
  "intent": "transfer",
  "confidence": 0.96,
  "extracted": {
    "amount": 200,
    "sourceCurrency": "EUR",
    "targetCurrency": "NGN",
    "recipient": "ade",
    "destinationHint": "Nigeria",
    "language": "fr",
    "rawText": "Envoyer 200 EUR vers NGN pour ade",
    "parsed": {
      "amount": 200,
      "sourceCurrency": "EUR",
      "targetCurrency": "NGN",
      "recipient": "ade",
      "destinationHint": "Nigeria",
      "language": "fr",
      "rawText": "Envoyer 200 EUR vers NGN pour ade"
    },
    "needsClarification": false,
    "clarificationQuestions": []
  }
}
```

## POST /quote

Weighted route optimization for supported corridors (`USD->PHP`, `EUR->NGN`, `GBP->KES`) with transparent scoring breakdown.

**Request**

```json
{
  "fromToken": "USD",
  "toToken": "PHP",
  "amount": "100",
  "destinationChain": "celo"
}
```

**Response**

```json
{
  "bestRoute": {
    "route": "celo->mento->gcash",
    "estimatedReceive": "5602.660000",
    "fee": "0.11",
    "etaSeconds": 42,
    "score": 0.761905,
    "scoring": {
      "weights": {
        "rate": 0.4,
        "slippageBps": 0.2,
        "gasUsd": 0.15,
        "etaSec": 0.1,
        "liquidityDepth": 0.15
      }
    },
    "metrics": {
      "rate": 56.15,
      "slippageBps": 20,
      "gasUsd": 0.11,
      "liquidityDepth": 680000
    }
  },
  "alternatives": [],
  "explanation": {
    "corridor": "USD->PHP",
    "strategy": "weighted-score(rate, slippage, gas, eta, liquidity)",
    "consideredRoutes": 3
  }
}
```

## POST /transfer

Creates a mock transfer and returns submitted status.

## GET /transfers/:id

Returns mock transfer settlement status.
