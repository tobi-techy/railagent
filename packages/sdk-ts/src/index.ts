import {
  ParseIntentRequest,
  ParseIntentResponse,
  QuoteRequest,
  QuoteResponse,
  TransferRequest,
  TransferResponse,
  TransferStatusResponse,
  ParseIntentResponseSchema,
  QuoteResponseSchema,
  TransferResponseSchema,
  TransferStatusResponseSchema
} from "@railagent/types";

export interface RailAgentSdkOptions {
  baseUrl: string;
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

  async transfer(payload: TransferRequest): Promise<TransferResponse> {
    const data = await this.post("/transfer", payload);
    return TransferResponseSchema.parse(data);
  }

  async getTransfer(id: string): Promise<TransferStatusResponse> {
    const res = await fetch(`${this.options.baseUrl}/transfers/${id}`);
    if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
    const data = await res.json();
    return TransferStatusResponseSchema.parse(data);
  }

  private async post(path: string, body: unknown): Promise<unknown> {
    const res = await fetch(`${this.options.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
    return res.json();
  }
}
