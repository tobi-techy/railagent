# RailAgent (Celo Infra Track)

TypeScript monorepo with deterministic multilingual intent parsing and route optimization.

## Structure

- `apps/api` - Fastify API (`/intent/parse`, `/quote`, `/transfer`)
- `packages/intent-parser` - EN/ES/PT/FR parser with confidence + clarification questions
- `packages/core` - corridor route scoring engine for `USD->PHP`, `EUR->NGN`, `GBP->KES`
- `packages/types` - shared Zod schemas + TypeScript types
- `packages/sdk-ts`, `packages/mento-adapter`, `apps/worker`, `apps/demo-agent` - scaffolds/placeholders

## Prerequisites

- Node.js 20+
- pnpm 9+

## Quick start

```bash
pnpm install
pnpm dev:api
```

API runs on `http://localhost:3000` by default.

## Useful scripts

- `pnpm dev:api` - start API in watch mode
- `pnpm typecheck` - run TypeScript checks across workspaces
- `pnpm test` - run parser + route scoring tests

## Quick curl examples

```bash
curl -X POST http://localhost:3000/intent/parse \
  -H 'content-type: application/json' \
  -d '{"text":"Quiero enviar 50 EUR para jose en Nigeria a NGN"}'
```

```bash
curl -X POST http://localhost:3000/quote \
  -H 'content-type: application/json' \
  -d '{"fromToken":"USD","toToken":"PHP","amount":"100","destinationChain":"celo"}'
```

See `docs/api.md` for full response examples.
