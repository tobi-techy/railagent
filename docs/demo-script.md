# 2-minute judge demo script (Phase 3a)

## Setup

```bash
pnpm install
cp .env.example .env
```

## Terminal 1 — start API

```bash
pnpm dev:api
```

Wait for: `RailAgent API listening on 3000`

## Terminal 2 — demo agent

### A) Interactive flow

```bash
pnpm -C apps/demo-agent dev
```

Paste prompt:

```text
send 100 usd to php to maria
```

Expected flow:
1. Agent parses intent (`/intent/parse`)
2. Agent gets route quote (`/quote`)
3. Agent prints best route + alternatives
4. Agent asks: `Execute transfer? (y/n)`
5. Type `y`
6. Agent executes transfer (`/transfer`) and prints:
   - final status
   - transfer id

### B) Clarification flow

In interactive mode, try:

```text
send money
```

Expected: agent prints clarification questions and does not execute.

### C) One-shot quote-only

```bash
pnpm -C apps/demo-agent run --text "send 50 eur to ngn to david"
```

Expected: quote summary only, with confirmation required message.

### D) One-shot execute

```bash
pnpm -C apps/demo-agent run --text "send 50 eur to ngn to david" --confirm
```

Expected: transfer submitted with transfer id.
