# RailAgent (Celo Infra Track)

Minimal TypeScript monorepo scaffold for a RailAgent hackathon project.

## Structure

- `apps/api` - Fastify API (mock parse/quote/transfer flow)
- `apps/worker` - Worker placeholder
- `apps/demo-agent` - Demo agent placeholder
- `packages/types` - Shared Zod schemas + TypeScript types
- `packages/sdk-ts` - TypeScript client SDK for the API
- `packages/core` - Core logic placeholder
- `packages/mento-adapter` - Mento adapter placeholder
- `packages/intent-parser` - Intent parser placeholder
- `infra/docker` - Docker scaffolding placeholder
- `infra/scripts` - Script scaffolding placeholder
- `docs` - Architecture and API docs

## Prerequisites

- Node.js 20+
- pnpm 9+

## Quick start

```bash
pnpm install
pnpm -C apps/api dev
```

API runs on `http://localhost:3000` by default.

## Useful scripts

- `pnpm dev:api` - start API in watch mode
- `pnpm build` - build all workspace packages/apps
- `pnpm typecheck` - run TypeScript checks across workspaces
