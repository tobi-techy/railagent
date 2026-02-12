export interface TransferPolicyConfig {
  maxAmount: number;
  allowedCorridors: string[];
  requireRecipient: boolean;
  requireIdempotencyKey: boolean;
}

export interface TransferPolicyInput {
  amount?: number;
  fromToken?: string;
  toToken?: string;
  recipient?: string;
  idempotencyKey?: string;
}

export interface PolicyViolation {
  code: "POLICY_RECIPIENT_REQUIRED" | "POLICY_IDEMPOTENCY_KEY_REQUIRED" | "POLICY_AMOUNT_REQUIRED" | "POLICY_MAX_AMOUNT_EXCEEDED" | "POLICY_CORRIDOR_NOT_ALLOWED";
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
  };
}

export function readTransferPolicyConfig(env: NodeJS.ProcessEnv = process.env): TransferPolicyConfig {
  const maxAmount = Number(env.TRANSFER_MAX_AMOUNT ?? "1000");
  const allowedCorridors = (env.TRANSFER_ALLOWED_CORRIDORS ?? "USD->PHP,EUR->NGN,GBP->KES")
    .split(",")
    .map((v) => v.trim().toUpperCase())
    .filter(Boolean);

  return {
    maxAmount: Number.isFinite(maxAmount) ? maxAmount : 1000,
    allowedCorridors,
    requireRecipient: true,
    requireIdempotencyKey: true
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

  if (!corridor || !config.allowedCorridors.includes(corridor)) {
    violations.push({
      code: "POLICY_CORRIDOR_NOT_ALLOWED",
      field: "fromToken,toToken",
      message: "Transfer corridor is not allowed",
      meta: { allowedCorridors: config.allowedCorridors, requestedCorridor: corridor }
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
      maxAmount: config.maxAmount
    }
  };
}
