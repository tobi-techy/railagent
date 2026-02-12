import {
  ParseIntentRequest,
  ParseIntentResponse,
  QuoteRequest,
  QuoteResponse,
  TransferRequest,
  TransferResponse,
  TransferStatusResponse,
  AgentMessageRequest,
  AgentMessageResponse,
  ParseIntentResponseSchema,
  QuoteResponseSchema,
  TransferResponseSchema,
  TransferStatusResponseSchema,
  AgentMessageResponseSchema
} from "@railagent/types";

export interface RailAgentSdkOptions {
  baseUrl: string;
}

export interface RequestOptions {
  headers?: Record<string, string>;
}

export class RailAgentApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "RailAgentApiError";
  }
}

export class RailAgentSdk {
  constructor(private readonly options: RailAgentSdkOptions) {}

  async parseIntent(payload: ParseIntentRequest): Promise<ParseIntentResponse> {
    const data = await this.post("/intent/parse", payload);
    return ParseIntentResponseSchema.parse(data);
  }

  async quote(payload: QuoteRequest): Promise<QuoteResponse> {
    const data = await this.post("/quote", payload);
    return QuoteResponseSchema.parse(data);
  }

  async transfer(payload: TransferRequest, options?: RequestOptions): Promise<TransferResponse> {
    const data = await this.post("/transfer", payload, options);
    return TransferResponseSchema.parse(data);
  }

  async getTransfer(id: string): Promise<TransferStatusResponse> {
    const res = await fetch(`${this.options.baseUrl}/transfers/${id}`);
    if (!res.ok) {
      throw await this.toApiError(res);
    }
    const data = await res.json();
    return TransferStatusResponseSchema.parse(data);
  }

  async agentMessage(payload: AgentMessageRequest): Promise<AgentMessageResponse> {
    const data = await this.post("/agent/message", payload);
    return AgentMessageResponseSchema.parse(data);
  }

  private async post(path: string, body: unknown, options?: RequestOptions): Promise<unknown> {
    const res = await fetch(`${this.options.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(options?.headers ?? {})
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) throw await this.toApiError(res);
    return res.json();
  }

  private async toApiError(res: Response): Promise<RailAgentApiError> {
    let payload: any = undefined;

    try {
      payload = await res.json();
    } catch {
      // keep undefined when body is not JSON
    }

    const message =
      payload?.error ||
      payload?.message ||
      `Request failed with status ${res.status}`;

    return new RailAgentApiError(message, res.status, payload?.code, payload);
  }
}
