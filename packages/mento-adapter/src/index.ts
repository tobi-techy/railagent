export type ProviderMode = "mock" | "live";

export interface ProviderConfig {
  mode: ProviderMode;
  rpcUrl?: string;
  chainId?: number;
  privateKey?: string;
}

export interface QuoteRequest {
  fromToken: string;
  toToken: string;
  amount: number;
}

export interface QuoteResult {
  provider: string;
  mode: ProviderMode;
  estimatedRate: number;
  estimatedReceive: string;
  feeUsd: string;
  routeHint: string;
}

export interface ExecuteTransferRequest {
  quoteId: string;
  recipient: string;
  amount: number;
  fromToken: string;
  toToken: string;
  idempotencyKey: string;
}

export interface ExecuteTransferResult {
  provider: string;
  mode: ProviderMode;
  transferId: string;
  status: "submitted" | "failed";
  txHash?: string;
}

export interface QuoteProvider {
  name: string;
  mode: ProviderMode;
  quote(request: QuoteRequest): Promise<QuoteResult>;
}

export interface ExecutionProvider {
  name: string;
  mode: ProviderMode;
  executeTransfer(request: ExecuteTransferRequest): Promise<ExecuteTransferResult>;
}

export class ProviderNotConfiguredError extends Error {
  readonly code = "PROVIDER_NOT_CONFIGURED";

  constructor(message: string, readonly missingKeys: string[]) {
    super(message);
    this.name = "ProviderNotConfiguredError";
  }
}

export class MockMentoProvider implements QuoteProvider, ExecutionProvider {
  readonly name = "mock-mento";
  readonly mode: ProviderMode = "mock";

  async quote(request: QuoteRequest): Promise<QuoteResult> {
    const pair = `${request.fromToken.toUpperCase()}-${request.toToken.toUpperCase()}`;
    const baseRate = pair === "USD-PHP" ? 56.1 : pair === "EUR-NGN" ? 1682 : pair === "GBP-KES" ? 163.7 : 1;
    const estimatedReceive = (request.amount * baseRate).toFixed(6);

    return {
      provider: this.name,
      mode: this.mode,
      estimatedRate: baseRate,
      estimatedReceive,
      feeUsd: "0.12",
      routeHint: "celo->mento->destination"
    };
  }

  async executeTransfer(request: ExecuteTransferRequest): Promise<ExecuteTransferResult> {
    const transferId = `tr_${request.idempotencyKey.slice(0, 10)}`;
    return {
      provider: this.name,
      mode: this.mode,
      transferId,
      status: "submitted",
      txHash: `0x${"ab".repeat(32)}`
    };
  }
}

export class LiveMentoProviderStub implements QuoteProvider, ExecutionProvider {
  readonly name = "live-mento-stub";
  readonly mode: ProviderMode = "live";

  constructor(private readonly config: ProviderConfig) {}

  validateConfigured(): void {
    const missingKeys: string[] = [];
    if (!this.config.rpcUrl) missingKeys.push("MENTO_RPC_URL");
    if (!this.config.chainId) missingKeys.push("MENTO_CHAIN_ID");
    if (!this.config.privateKey) missingKeys.push("MENTO_PRIVATE_KEY");

    if (missingKeys.length > 0) {
      throw new ProviderNotConfiguredError(
        `Live provider is not configured. Missing: ${missingKeys.join(", ")}`,
        missingKeys
      );
    }
  }

  async quote(_request: QuoteRequest): Promise<QuoteResult> {
    this.validateConfigured();
    throw new Error("LIVE_PROVIDER_NOT_IMPLEMENTED");
  }

  async executeTransfer(_request: ExecuteTransferRequest): Promise<ExecuteTransferResult> {
    this.validateConfigured();
    throw new Error("LIVE_PROVIDER_NOT_IMPLEMENTED");
  }
}

function readProviderConfigFromEnv(env: NodeJS.ProcessEnv = process.env): ProviderConfig {
  return {
    mode: env.MENTO_PROVIDER_MODE === "live" ? "live" : "mock",
    rpcUrl: env.MENTO_RPC_URL,
    chainId: env.MENTO_CHAIN_ID ? Number(env.MENTO_CHAIN_ID) : undefined,
    privateKey: env.MENTO_PRIVATE_KEY
  };
}

export function createMentoProviders(env: NodeJS.ProcessEnv = process.env): {
  quoteProvider: QuoteProvider;
  executionProvider: ExecutionProvider;
  fallbackReason?: string;
} {
  const config = readProviderConfigFromEnv(env);

  if (config.mode === "live") {
    const live = new LiveMentoProviderStub(config);
    try {
      // Validate early so app can fallback deterministically.
      live.validateConfigured();
      return { quoteProvider: live, executionProvider: live };
    } catch (error) {
      const reason = error instanceof ProviderNotConfiguredError ? error.message : "unknown live provider error";
      const mock = new MockMentoProvider();
      return {
        quoteProvider: mock,
        executionProvider: mock,
        fallbackReason: reason
      };
    }
  }

  const mock = new MockMentoProvider();
  return { quoteProvider: mock, executionProvider: mock };
}
