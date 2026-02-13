# RailAgent — Cross-Border Payment Infrastructure for AI Agents on Celo

> **Celo Hackathon: Build Agents for the Real World — Infra Track**

AI agents are starting to move money. But moving money cross-border is hard — currency corridors, fee optimization, compliance guardrails, settlement verification. Every agent builder shouldn't have to solve this from scratch.

**RailAgent is programmable remittance infrastructure for Celo.** Any AI agent can call a single API to parse payment intent, get optimized routing via Mento, enforce configurable safety policies, execute stablecoin transfers, and receive signed webhook events on settlement.

## Why this exists

As agentic commerce scales, agents will need to make cross-border payments — paying services, settling with suppliers, executing user-requested remittances. Today, every builder rolls their own parsing, routing, and safety logic. RailAgent provides that as composable infra:

- **Policy engine** — Programmable guardrails: per-corridor limits, per-currency caps, recipient validation, risk destination flagging, idempotency enforcement. Agents move money safely without each builder reimplementing compliance logic.
- **Route optimization** — Weighted multi-factor scoring (rate, slippage, gas, ETA, liquidity depth) across Celo/Mento corridors. Agents get the best route, not just any route.
- **Multilingual intent parsing** — Optional NLP layer that handles noisy, multilingual user input (EN/ES/PT/FR) with typo tolerance. Useful for agents with human-facing interfaces.
- **Settlement webhooks** — HMAC-signed, retried webhook events (`transfer.submitted`, `transfer.settled`, `transfer.failed`) so agents can react to payment lifecycle asynchronously.
- **Provider abstraction** — Pluggable execution layer (mock for dev, live Mento for testnet/mainnet) with automatic fallback and structured error reporting.

## Quickstart

```bash
cp .env.example .env
pnpm install
pnpm dev:api
```

The API starts on `http://localhost:3000` with mock providers — no secrets needed for local dev.

### Developer-scoped API key onboarding

Set an admin token for key management:

```bash
export API_ADMIN_TOKEN=super_admin_token
```

Create a key for a developer account (raw key is returned once):

```bash
curl -X POST http://localhost:3000/auth/keys \
  -H 'content-type: application/json' \
  -H "x-admin-token: $API_ADMIN_TOKEN" \
  -d '{"developerId":"dev_acme","label":"prod-agent","rateLimitPerMin":120}'
```

Use the returned `rawKey` on write endpoints:

```bash
curl -X POST http://localhost:3000/transfer \
  -H 'content-type: application/json' \
  -H 'x-api-key: <RAW_KEY>' \
  -H 'Idempotency-Key: idem_acme_001' \
  -d '{"quoteId":"qt_demo_001","recipient":"maria","amount":"120","fromToken":"USD","toToken":"PHP"}'
```

Legacy `API_WRITE_KEYS` values are still accepted for backward compatibility and logged with `source=legacy`.

## Integration example

An AI agent needs to send a cross-border payment. Five lines with the SDK:

```typescript
import { RailAgentSdk } from "@railagent/sdk-ts";

const rail = new RailAgentSdk({ baseUrl: "http://localhost:3000" });

// 1. Get optimized quote with fee comparison
const quote = await rail.quote({
  fromToken: "USD", toToken: "PHP",
  amount: "120", destinationChain: "celo"
});

// 2. Execute with policy checks + idempotency
const transfer = await rail.transfer(
  { quoteId: "qt_demo", recipient: "maria", amount: "120", fromToken: "USD", toToken: "PHP" },
  { headers: { "x-api-key": "your_key", "idempotency-key": "unique_key" } }
);

// 3. Check settlement status
const status = await rail.getTransfer(transfer.id);
```

Or use the natural-language endpoint for agents with human-facing UX:

```bash
curl -X POST http://localhost:3000/agent/message \
  -H 'content-type: application/json' \
  -d '{"sessionId":"agent-1","text":"send 120 usd to maria in manila","confirm":false}'
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Any AI Agent (LangChain, CrewAI, custom, etc.)     │
└──────────────────────┬──────────────────────────────┘
                       │ REST / SDK
┌──────────────────────▼──────────────────────────────┐
│  RailAgent API                                       │
│  ┌──────────┐ ┌───────────┐ ┌────────────────────┐  │
│  │ NL Parse │ │ Route     │ │ Policy Engine      │  │
│  │ (opt.)   │ │ Optimizer │ │ (guardrails)       │  │
│  └──────────┘ └───────────┘ └────────────────────┘  │
│  ┌──────────────────┐ ┌─────────────────────────┐   │
│  │ Provider Layer   │ │ Webhook Dispatcher      │   │
│  │ (Mento/mock)     │ │ (HMAC-signed, retried)  │   │
│  └──────────────────┘ └─────────────────────────┘   │
└──────────────────────┬──────────────────────────────┘
                       │
              ┌────────▼────────┐
              │   Celo Network  │
              │   (Mento DEX)   │
              └─────────────────┘
```

## Monorepo structure

| Package | Purpose |
|---|---|
| `packages/types` | Zod schemas — single source of truth for all API contracts |
| `packages/core` | Route scoring engine + transfer policy evaluation |
| `packages/intent-parser` | Multilingual NLP with typo tolerance (EN/ES/PT/FR) |
| `packages/mento-adapter` | Provider abstraction (mock ↔ live Mento) with fallback |
| `packages/sdk-ts` | TypeScript SDK for agent integration |
| `apps/api` | Fastify HTTP API — the infra service |
| `apps/demo-agent` | CLI demo agent showing integration patterns |

## Policy engine

The safety layer evaluates every transfer before execution:

| Policy | Config env var | Default |
|---|---|---|
| Max transfer amount | `TRANSFER_MAX_AMOUNT` | 1000 |
| Per-currency limits | `TRANSFER_MAX_BY_CURRENCY` | USD:2000, EUR:1500, GBP:1200 |
| Allowed corridors | `TRANSFER_ALLOWED_CORRIDORS` | USD→PHP, EUR→NGN, GBP→KES |
| Risk destinations | `TRANSFER_RISK_DESTINATIONS` | (none) |
| Require recipient | always | ✓ |
| Require idempotency key | always | ✓ |

Policy violations return structured, machine-readable decisions:

```json
{
  "allowed": false,
  "violations": [
    { "code": "POLICY_MAX_AMOUNT_EXCEEDED", "field": "amount", "message": "Amount exceeds max transfer policy (1000)" }
  ]
}
```

## API endpoints

| Method | Path | Purpose | Auth |
|---|---|---|---|
| `POST` | `/agent/message` | Natural-language agent conversation | — |
| `POST` | `/intent/parse` | Structured intent extraction | — |
| `POST` | `/quote` | Route optimization + fee comparison | — |
| `POST` | `/auth/keys` | Create developer-scoped write key (returns raw once) | Admin token |
| `GET` | `/auth/keys?developerId=...` | List developer keys | Admin token |
| `POST` | `/auth/keys/:id/revoke` | Revoke a developer key | Admin token |
| `POST` | `/transfer` | Execute transfer with policy checks | Developer API key (or legacy fallback) |
| `GET` | `/transfers/:id` | Settlement status | — |
| `POST` | `/webhooks/register` | Subscribe to transfer events | Developer API key (or legacy fallback) |
| `GET` | `/webhooks` | List registered webhook targets | — |

## Webhook events

Agents subscribe to signed lifecycle events:

- `transfer.submitted` — transfer accepted and sent to Celo
- `transfer.settled` — on-chain confirmation received
- `transfer.failed` — execution failed

Events are HMAC-SHA256 signed (`x-railagent-signature`) with timestamp tolerance and automatic retry (1s, 3s, 7s backoff).

## Demo

Interactive conversation:

```bash
pnpm dev:api
pnpm -C apps/demo-agent dev -- --session-id judge-1
```

One-shot commands:

```bash
pnpm -C apps/demo-agent run --text "send 120 usd to maria in manila" --session-id judge-1
pnpm -C apps/demo-agent run --text "use the cheapest option" --session-id judge-1
pnpm -C apps/demo-agent run --text "confirm and send" --session-id judge-1 --confirm
```

Multilingual examples (typo-tolerant):

- EN: `pls sned 120 usd to my mom maria in manila to php every month`
- ES: `quiero enivar 50 eur para mi hermano jose en lagos a ngn mensual`
- PT: `preciso tranfser 75 gbp para minha mae ana no kenya em kes mensal`
- FR: `donne moi un deivs pour 200 eur vers ngn`

## Quality

```bash
pnpm typecheck
pnpm test
```

## Landing page (developer-facing SaaS site)

A dedicated landing app is available at `apps/landing` (Next.js + Tailwind).

Run locally:

```bash
pnpm install
pnpm dev:landing
```

Build/start for deployment:

```bash
pnpm build:landing
pnpm start:landing
```

Default local URL: `http://localhost:3001`

## License

MIT
