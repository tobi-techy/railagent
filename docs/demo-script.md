# Judge-ready natural conversation demo

## Setup

```bash
pnpm dev:api
```

```bash
pnpm -C apps/demo-agent dev -- --session-id judge-1
```

## Live conversation flow

1. User (EN typo/noisy):
   - `pls sned 120 usd to my mom maria in manila to php every month`
2. Agent:
   - shows interpreted plan + confidence
   - shows Celo route options and fee comparison savings
   - asks for confirmation
3. User follow-up memory turn:
   - `use the cheapest option`
4. Agent:
   - reuses same session context and updates plan
5. User confirmation:
   - `yes send it now`

## Multilingual spot checks

- ES: `quiero enivar 50 eur para mi hermano jose en lagos a ngn mensual`
- PT: `preciso tranfser 75 gbp para minha mae ana no kenya em kes mensal`
- FR: `donne moi un deivs pour 200 eur vers ngn`

## One-shot API-only run

```bash
curl -X POST http://localhost:3000/agent/message -H 'content-type: application/json' -d '{"sessionId":"judge-1","text":"sned 120 usd to my mom in manila","confirm":false}'
curl -X POST http://localhost:3000/agent/message -H 'content-type: application/json' -d '{"sessionId":"judge-1","text":"confirm","confirm":true}'
```

## Important narration points

- Celo stablecoin rail is used for transfer execution (provider abstraction mock/live stub).
- idempotency + policy checks run before execution.
- legacy fee comparisons are baseline estimates (not live third-party quotes).
