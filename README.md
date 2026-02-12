# RailAgent (Celo Infra Track) – Production Sprint

RailAgent is now a production-oriented AI remittance agent scaffold with:

- live-capable AI parsing (Gemini + deterministic fallback)
- hardened API controls (API keys, rate limiting, correlation IDs, error taxonomy)
- security/trust controls (audit logs, policy checks, webhook replay protection helper)
- demo-ready developer workflow

## What is now live

- `/intent/parse` supports runtime provider mode via env:
  - `AI_PROVIDER=openclaw` (native mode, safely falls back if unavailable)
  - `AI_PROVIDER=gemini` (uses Gemini API when key present)
  - default deterministic parser fallback
- structured extraction is validated against schema before acceptance
- `/transfer` and `/webhooks/register` require API key auth (if configured)
- per-identity rate limiting on agent + transfer endpoints
- request logging includes correlation ID (`x-correlation-id`)
- audit events for parse, quote, and transfer policy decisions
- policy expanded with per-currency limits and destination risk flags
- webhook consumer replay/signature verification helper (`/webhooks/verify` and code util)

## Quickstart (production profile)

```bash
cp .env.example .env
pnpm install
pnpm dev:api
```

Then in another terminal:

```bash
pnpm demo:live
```

## Env template (prod profile)

```env
PORT=3000

# AI layer
AI_PROVIDER=gemini
AI_MODEL=gemini-1.5-flash
GEMINI_API_KEY=your_gemini_key

# Write auth + limits
API_WRITE_KEYS=prod_key_1,prod_key_2
RATE_LIMIT_PER_MIN=60
RATE_LIMIT_WINDOW_MS=60000

# Transfer policy
TRANSFER_MAX_AMOUNT=1000
TRANSFER_MAX_BY_CURRENCY=USD:2000,EUR:1500,GBP:1200
TRANSFER_ALLOWED_CORRIDORS=USD->PHP,EUR->NGN,GBP->KES
TRANSFER_RISK_DESTINATIONS=highriskland

# Webhooks
WEBHOOK_SECRET=change_this

# Mento provider
MENTO_PROVIDER_MODE=mock
MENTO_RPC_URL=
MENTO_CHAIN_ID=
MENTO_PRIVATE_KEY=
```

## Demo commands

```bash
# API
pnpm dev:api

# one-shot realistic flow
pnpm demo:live

# manual demo-agent
pnpm -C apps/demo-agent dev

# checks
pnpm typecheck
pnpm test
```

## HTTP examples (Postman/cURL)

See `docs/api.md` for ready-to-paste examples for parse, quote, transfer, webhook register, and webhook signature verification.

## Submission checklist

- Run: `pnpm typecheck && pnpm test`
- Capture logs showing:
  - fallback-safe AI parsing
  - API key protection on write routes
  - policy block example
  - webhook signature verification example
