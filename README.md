# RailAgent – Natural-Language Remittance Agent on Celo Rails

RailAgent is now a **natural-language AI remittance agent** (not a rigid intent-parser UX), with:

- multilingual understanding: English, Spanish, Portuguese, French
- typo/noisy input tolerance (e.g., `sned`, `enivar`, `deivs`)
- conversational flow with clarification and confirmation
- short-term session memory (`sessionId`) for follow-up turns
- cross-border execution on Celo stablecoin rails via provider abstractions (mock/live stub)
- fee comparison vs baseline Western Union / Wise estimates + savings output
- OpenClaw-compatible orchestration endpoint (`POST /agent/message`)

## Quickstart

```bash
cp .env.example .env
pnpm install
pnpm dev:api
```

In another terminal:

```bash
pnpm -C apps/demo-agent dev
```

## Natural-language agent endpoint

`POST /agent/message`

```json
{ "sessionId": "judge-1", "text": "sned 120 usd to my mom in manila every month", "confirm": false }
```

Response includes assistant text, action state, quote, comparison, and optional transfer result.

## Noisy multilingual examples now supported

- EN: `pls sned 120 usd to my mom maria in manila to php every month`
- ES: `quiero enivar 50 eur para mi hermano jose en lagos a ngn mensual`
- PT: `preciso tranfser 75 gbp para minha mae ana no kenya em kes mensal`
- FR: `donne moi un deivs pour 200 eur vers ngn`

## Fee comparison disclaimer

Comparisons are **estimates from configurable baseline tables** and are not live third-party quotes.

## Demo commands

```bash
pnpm dev:api
pnpm -C apps/demo-agent dev -- --session-id judge-1
pnpm -C apps/demo-agent run --text "send 120 usd to maria in manila" --session-id judge-1
pnpm -C apps/demo-agent run --text "use the cheapest option and make it monthly" --session-id judge-1
pnpm -C apps/demo-agent run --text "confirm and send now" --session-id judge-1 --confirm
```

## Quality checks

```bash
pnpm typecheck
pnpm test
```
