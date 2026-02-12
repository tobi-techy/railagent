export interface TransferPolicyConfig {
  maxAmount: number;
  maxAmountPerCurrency: Record<string, number>;
  allowedCorridors: string[];
  requireRecipient: boolean;
  requireIdempotencyKey: boolean;
  riskDestinations: string[];
}

export interface TransferPolicyInput {
  amount?: number;
  fromToken?: string;
  toToken?: string;
  recipient?: string;
  destinationHint?: string;
  idempotencyKey?: string;
}

export interface PolicyViolation {
  code:
    | "POLICY_RECIPIENT_REQUIRED"
    | "POLICY_IDEMPOTENCY_KEY_REQUIRED"
    | "POLICY_AMOUNT_REQUIRED"
    | "POLICY_MAX_AMOUNT_EXCEEDED"
    | "POLICY_CURRENCY_MAX_EXCEEDED"
    | "POLICY_CORRIDOR_NOT_ALLOWED"
    | "POLICY_RISK_DESTINATION";
  message: string;
  field?: string;
  meta?: Record<string, unknown>;
}

export interface PolicyDecision {
  allowed: boolean;
  violations: PolicyViolation[];
  context: {
    corridor?: string;
    amount?: number;
    maxAmount: number;
    destinationHint?: string;
  };
}

function parseCurrencyLimits(raw: string | undefined): Record<string, number> {
  if (!raw) return {};
  const out: Record<string, number> = {};
  for (const item of raw.split(",").map((v) => v.trim()).filter(Boolean)) {
    const [currency, value] = item.split(":");
    const parsed = Number(value);
    if (currency && Number.isFinite(parsed)) out[currency.toUpperCase()] = parsed;
  }
  return out;
}

export function readTransferPolicyConfig(env: NodeJS.ProcessEnv = process.env): TransferPolicyConfig {
  const maxAmount = Number(env.TRANSFER_MAX_AMOUNT ?? "1000");
  const allowedCorridors = (env.TRANSFER_ALLOWED_CORRIDORS ?? "USD->PHP,EUR->NGN,GBP->KES")
    .split(",")
    .map((v) => v.trim().toUpperCase())
    .filter(Boolean);

  return {
    maxAmount: Number.isFinite(maxAmount) ? maxAmount : 1000,
    maxAmountPerCurrency: parseCurrencyLimits(env.TRANSFER_MAX_BY_CURRENCY),
    allowedCorridors,
    requireRecipient: true,
    requireIdempotencyKey: true,
    riskDestinations: (env.TRANSFER_RISK_DESTINATIONS ?? "")
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean)
  };
}

function corridorKey(fromToken?: string, toToken?: string): string | undefined {
  if (!fromToken || !toToken) return undefined;
  return `${fromToken.toUpperCase()}->${toToken.toUpperCase()}`;
}

export function evaluateTransferPolicy(
  input: TransferPolicyInput,
  config: TransferPolicyConfig = readTransferPolicyConfig()
): PolicyDecision {
  const violations: PolicyViolation[] = [];
  const corridor = corridorKey(input.fromToken, input.toToken);

  if (!input.amount || Number.isNaN(input.amount) || input.amount <= 0) {
    violations.push({
      code: "POLICY_AMOUNT_REQUIRED",
      field: "amount",
      message: "Amount is required and must be greater than zero"
    });
  } else if (input.amount > config.maxAmount) {
    violations.push({
      code: "POLICY_MAX_AMOUNT_EXCEEDED",
      field: "amount",
      message: `Amount exceeds max transfer policy (${config.maxAmount})`,
      meta: { maxAmount: config.maxAmount, receivedAmount: input.amount }
    });
  }

  const fromToken = input.fromToken?.toUpperCase();
  const perCurrencyLimit = fromToken ? (config.maxAmountPerCurrency ?? {})[fromToken] : undefined;
  if (input.amount && perCurrencyLimit && input.amount > perCurrencyLimit) {
    violations.push({
      code: "POLICY_CURRENCY_MAX_EXCEEDED",
      field: "amount",
      message: `${fromToken} transfers above ${perCurrencyLimit} are blocked by policy`,
      meta: { currency: fromToken, limit: perCurrencyLimit, receivedAmount: input.amount }
    });
  }

  if (!corridor || !config.allowedCorridors.includes(corridor)) {
    violations.push({
      code: "POLICY_CORRIDOR_NOT_ALLOWED",
      field: "fromToken,toToken",
      message: "Transfer corridor is not allowed",
      meta: { allowedCorridors: config.allowedCorridors, requestedCorridor: corridor }
    });
  }

  const destinationHint = input.destinationHint?.toLowerCase();
  if (destinationHint && config.riskDestinations.includes(destinationHint)) {
    violations.push({
      code: "POLICY_RISK_DESTINATION",
      field: "destinationHint",
      message: `Destination ${input.destinationHint} is currently flagged for manual review`,
      meta: { riskDestinations: config.riskDestinations }
    });
  }

  if (config.requireRecipient && !input.recipient?.trim()) {
    violations.push({
      code: "POLICY_RECIPIENT_REQUIRED",
      field: "recipient",
      message: "Recipient is required"
    });
  }

  if (config.requireIdempotencyKey && !input.idempotencyKey?.trim()) {
    violations.push({
      code: "POLICY_IDEMPOTENCY_KEY_REQUIRED",
      field: "idempotencyKey",
      message: "Idempotency key is required"
    });
  }

  return {
    allowed: violations.length === 0,
    violations,
    context: {
      corridor,
      amount: input.amount,
      maxAmount: config.maxAmount,
      destinationHint: input.destinationHint
    }
  };
}
