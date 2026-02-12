# RailAgent Architecture (Phase 2)

## Overview

RailAgent is a pnpm + TypeScript monorepo with clear boundaries between API, domain logic, and integration adapters.

## Monorepo layout

- `apps/api`: Fastify HTTP API exposing parsing, quoting, transfers, and webhook management.
- `apps/worker`: Placeholder for background jobs.
- `apps/demo-agent`: Placeholder for conversational/demo integration.
- `packages/types`: Shared API schemas and TypeScript types (Zod source of truth).
- `packages/intent-parser`: Deterministic multilingual intent extraction.
- `packages/core`: Route scoring + transfer policy/safety evaluation.
- `packages/mento-adapter`: Provider abstraction for quote/execution (mock + live stub).
- `packages/sdk-ts`: SDK scaffold.

## Provider abstraction

`packages/mento-adapter` defines:

- `QuoteProvider` interface
- `ExecutionProvider` interface
- `MockMentoProvider` (default deterministic behavior)
- `LiveMentoProviderStub` (env-aware, explicit not-configured errors)

Provider selection is centralized in `createMentoProviders()`:

- `MENTO_PROVIDER_MODE=mock` → use mock provider
- `MENTO_PROVIDER_MODE=live` + missing config → deterministic fallback to mock with `fallbackReason`

This keeps local/dev setup runnable without secrets while preparing integration seams for live testnet execution.

## Policy and safety layer

`packages/core/src/policy.ts` evaluates transfer requests before execution:

- max amount (`TRANSFER_MAX_AMOUNT`)
- allowed corridors (`TRANSFER_ALLOWED_CORRIDORS`)
- required recipient
- required idempotency key

Result is a structured policy decision:

- `allowed: boolean`
- `violations[]` with machine-readable `code`, `message`, `field`, and optional `meta`

`POST /transfer` blocks execution and returns `422` if policy denies.

## Webhook subsystem

`apps/api/src/webhooks.ts` provides MVP webhook mechanics:

- in-memory target registry
- event envelope schema (`id`, `type`, `timestamp`, `data`)
- HMAC-SHA256 signing using `WEBHOOK_SECRET`
- retry queue with backoff (1s, 3s, 7s)

Endpoints:

- `POST /webhooks/register`
- `GET /webhooks`

Events emitted for transfer lifecycle:

- `transfer.submitted`
- `transfer.settled`
- `transfer.failed` (reserved)

## Runtime flow (`POST /transfer`)

1. Validate request schema
2. Read `Idempotency-Key`
3. Evaluate policy
4. Execute transfer via selected provider
5. Store transfer status
6. Emit signed webhook events
7. Return transfer response with policy + provider metadata
