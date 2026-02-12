# RailAgent API

Base URL (local): `http://localhost:3000`

## GET /health

Returns service health.

**Response**

```json
{
  "status": "ok",
  "service": "railagent-api",
  "timestamp": "2026-02-12T10:00:00.000Z"
}
```

## POST /intent/parse

Mock intent parser with confidence score.

**Request**

```json
{
  "text": "Send 20 cUSD to 0xabc..."
}
```

**Response**

```json
{
  "intent": "transfer",
  "confidence": 0.9,
  "extracted": {
    "rawText": "Send 20 cUSD to 0xabc..."
  }
}
```

## POST /quote

Mock route optimization response with alternatives.

**Request**

```json
{
  "fromToken": "cUSD",
  "toToken": "USDC",
  "amount": "100",
  "destinationChain": "base"
}
```

**Response**

```json
{
  "bestRoute": {
    "route": "celo->mento->destination",
    "estimatedReceive": "99.500000",
    "fee": "0.10",
    "etaSeconds": 45
  },
  "alternatives": [
    {
      "route": "celo->mento->destination",
      "estimatedReceive": "99.500000",
      "fee": "0.10",
      "etaSeconds": 45
    },
    {
      "route": "celo->bridge-x->destination",
      "estimatedReceive": "99.200000",
      "fee": "0.15",
      "etaSeconds": 60
    }
  ]
}
```

## POST /transfer

Creates a mock transfer and returns submitted status.

**Request**

```json
{
  "quoteId": "q_123",
  "recipient": "0xrecipient"
}
```

**Response**

```json
{
  "id": "tr_xxxxxxxx",
  "status": "submitted"
}
```

## GET /transfers/:id

Returns mock transfer settlement status.

**Response**

```json
{
  "id": "tr_xxxxxxxx",
  "status": "settled",
  "txHash": "0xabab..."
}
```
