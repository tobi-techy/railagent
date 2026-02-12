# RailAgent Architecture (Hackathon Scaffold)

## Overview

RailAgent is organized as a pnpm + TypeScript monorepo with clear boundaries between apps and reusable packages.

## Monorepo layout

- `apps/api`: Fastify HTTP API exposing intent parsing, quoting, and transfer lifecycle endpoints.
- `apps/worker`: Placeholder for background jobs (settlement polling, retries, indexing).
- `apps/demo-agent`: Placeholder for conversational/demo integration.
- `packages/types`: Shared API schemas and TypeScript types (Zod as source of truth).
- `packages/sdk-ts`: TypeScript SDK for external clients to call RailAgent API.
- `packages/core`: Placeholder for business orchestration logic.
- `packages/mento-adapter`: Placeholder for Mento protocol integration.
- `packages/intent-parser`: Placeholder for NLP / intent extraction pipeline.
- `infra/docker`: Placeholder for container files.
- `infra/scripts`: Placeholder for operational scripts.

## Design choices

1. **Schemas first** with Zod in `packages/types` to keep API contracts consistent.
2. **Thin API layer** in `apps/api` for fast iteration during hackathon.
3. **SDK package** for clean integration from UIs/bots/agents.
4. **Modular packages** reserved for scaling beyond MVP.
