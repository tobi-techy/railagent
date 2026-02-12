# RailAgent (Celo Infra Track)

TypeScript monorepo with deterministic multilingual intent parsing, route optimization, and **Phase 2** scaffolding for transfer policy + signed webhooks + provider abstraction.

## Phase 2 highlights

- Celo/Mento provider abstraction with:
  - quote provider interface
  - execution provider interface
  - default deterministic mock provider
  - live provider stub (env-driven) with explicit fallback when not configured
- Transfer policy/safety layer:
  - max amount enforcement
  - allowed corridor checks
  - recipient required
  - idempotency key required (`Idempotency-Key` header)
- Signed webhook dispatcher:
  - `x-railagent-signature` HMAC-SHA256 header
  - in-memory registration + delivery queue
  - retry with backoff for failed webhook deliveries

## Structure

- `apps/api` - Fastify API (`/intent/parse`, `/quote`, `/transfer`, `/webhooks/register`, `/webhooks`)
- `packages/intent-parser` - EN/ES/PT/FR parser with confidence + clarification questions
- `packages/core` - route scoring + transfer policy evaluation
- `packages/mento-adapter` - provider interfaces + mock/live stub selection
- `packages/types` - shared Zod schemas + TypeScript types
- `packages/sdk-ts`, `apps/worker`, `apps/demo-agent` - scaffolds/placeholders

## Prerequisites

- Node.js 20+
- pnpm 9+

## Environment setup

```bash
cp .env.example .env
```

Key variables:

- `MENTO_PROVIDER_MODE=mock|live`
- `MENTO_RPC_URL`
- `MENTO_CHAIN_ID`
- `MENTO_PRIVATE_KEY` (placeholder for testnet key)
- `TRANSFER_MAX_AMOUNT`
- `TRANSFER_ALLOWED_CORRIDORS`
- `WEBHOOK_SECRET`

> Default mode is `mock`, so the app remains runnable without secrets.

## Run

```bash
pnpm install
pnpm dev:api
```

API runs on `http://localhost:3000` by default.

## Useful scripts

- `pnpm dev:api` - start API in watch mode
- `pnpm -C apps/demo-agent dev` - start interactive demo-agent REPL
- `pnpm -C apps/demo-agent run --text "send 100 usd to php to maria" --confirm` - run one-shot transfer flow
- `pnpm typecheck` - run TypeScript checks across workspaces
- `pnpm test` - run all tests (core, provider selection, webhook signing, demo-agent)

## Agent demo

The `apps/demo-agent` app provides a deterministic "AI-agent style" CLI on top of the existing API.
No external LLM calls are required.

### 1) Start API

```bash
pnpm dev:api
```

### 2) Interactive mode

```bash
pnpm -C apps/demo-agent dev
```

- Enter natural-language remittance requests.
- Agent calls `/intent/parse` then `/quote`.
- Agent explains best route and alternatives.
- Agent asks `y/n` before calling `/transfer`.

### 3) One-shot mode

Quote only (no execution):

```bash
pnpm -C apps/demo-agent run --text "send 100 usd to php to maria"
```

Execute transfer (requires explicit confirm flag):

```bash
pnpm -C apps/demo-agent run --text "send 100 usd to php to maria" --confirm
```

If `/intent/parse` returns clarification requirements, the demo-agent prints those questions and does not execute.

See `docs/demo-script.md` for a 2-minute judge flow.

## Quick curl examples

```bash
curl -X POST http://localhost:3000/webhooks/register \
  -H 'content-type: application/json' \
  -d '{"url":"https://example.com/webhooks/railagent"}'
```

```bash
curl -X POST http://localhost:3000/transfer \
  -H 'content-type: application/json' \
  -H 'Idempotency-Key: idem_001' \
  -d '{"quoteId":"qt_123","recipient":"maria","amount":"100","fromToken":"USD","toToken":"PHP"}'
```

See `docs/api.md` for full request/response examples, including signature verification.
