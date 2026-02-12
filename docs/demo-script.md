# Judge demo script (real-world remittance scenarios)

## Scenario 1: Freelancer payout (USD -> PHP)
- User: “Send 120 USD to Maria in Manila, convert to PHP.”
- Show `/intent/parse` structured extraction.
- Show `/quote` best + alternatives.
- Execute `/transfer` with API key + idempotency header.
- Mention policy and audit log event emitted.

## Scenario 2: Family remittance (EUR -> NGN)
- User: “Transfer 80 EUR to my brother in Lagos in NGN.”
- Show destination detection and corridor routing.
- Show low-fee route recommendation and ETA.

## Scenario 3: Marketplace settlement (GBP -> KES)
- User: “Pay 300 GBP settlement to vendor_kenya in KES.”
- Demonstrate policy limits by trying 3000 GBP (blocked by per-currency cap).
- Show returned `POLICY_VIOLATION` with explicit violation details.

---

## Live demo commands

```bash
pnpm dev:api
```

```bash
pnpm demo:live
```

Manual one-shot examples:

```bash
pnpm -C apps/demo-agent run --text "Transfer 80 EUR to jose in Lagos to NGN" --confirm
pnpm -C apps/demo-agent run --text "Pay 300 GBP to vendor_kenya in KES" --confirm
```
