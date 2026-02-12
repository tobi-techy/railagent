import crypto from "node:crypto";
import { RailAgentApiError, RailAgentSdk } from "@railagent/sdk-ts";

export interface AgentResult {
  lines: string[];
  needsConfirmation: boolean;
  executed: boolean;
}

export interface RunAgentOptions {
  confirm: boolean;
}

export interface ParseIntentLike {
  intent: string;
  confidence: number;
  extracted: Record<string, any>;
}

export interface DemoAgentClient {
  parseIntent(payload: { text: string }): Promise<ParseIntentLike>;
  quote(payload: {
    fromToken: string;
    toToken: string;
    amount: string;
    destinationChain: string;
  }): Promise<{
    bestRoute: { route: string; estimatedReceive: string; fee: string; etaSeconds: number };
    alternatives: Array<{ route: string; estimatedReceive: string; fee: string; etaSeconds: number }>;
  }>;
  transfer(
    payload: {
      quoteId: string;
      recipient?: string;
      amount?: string;
      fromToken?: string;
      toToken?: string;
    },
    options?: { headers?: Record<string, string> }
  ): Promise<{ id: string; status: string }>;
}

export function createClient(baseUrl: string): DemoAgentClient {
  const sdk = new RailAgentSdk({ baseUrl });
  const writeKey = process.env.RAILAGENT_WRITE_API_KEY;

  return {
    parseIntent: (payload) => sdk.parseIntent(payload),
    quote: (payload) => sdk.quote(payload),
    transfer: (payload, options) =>
      sdk.transfer(payload, {
        headers: {
          ...(options?.headers ?? {}),
          ...(writeKey ? { "x-api-key": writeKey } : {})
        }
      })
  };
}

export async function runAgentFlow(
  client: DemoAgentClient,
  text: string,
  options: RunAgentOptions
): Promise<AgentResult> {
  try {
    const parsed = await client.parseIntent({ text });
    const extracted = normalizeExtracted(parsed.extracted);

    if (extracted.needsClarification) {
      const questions: string[] = extracted.clarificationQuestions ?? [];
      return {
        lines: [
          "I need a bit more information before I can proceed:",
          ...questions.map((q, i) => `${i + 1}. ${q}`)
        ],
        needsConfirmation: false,
        executed: false
      };
    }

    const amount = extracted.amount;
    const fromToken = extracted.sourceCurrency;
    const toToken = extracted.targetCurrency;
    const recipient = extracted.recipient;

    const missing: string[] = [];
    if (!amount) missing.push("amount");
    if (!fromToken) missing.push("source currency");
    if (!toToken) missing.push("target currency");

    if (missing.length > 0) {
      return {
        lines: [`Missing required fields: ${missing.join(", ")}. Please provide a clearer transfer request.`],
        needsConfirmation: false,
        executed: false
      };
    }

    const quote = await client.quote({
      fromToken,
      toToken,
      amount: String(amount),
      destinationChain: "celo"
    });

    const lines: string[] = [];
    lines.push(
      `Best route: ${quote.bestRoute.route} | receive ~${quote.bestRoute.estimatedReceive} ${toToken} | fee $${quote.bestRoute.fee} | ETA ${quote.bestRoute.etaSeconds}s`
    );

    const alt = quote.alternatives.filter((a) => a.route !== quote.bestRoute.route).slice(0, 2);
    if (alt.length > 0) {
      lines.push("Alternatives:");
      for (const item of alt) {
        lines.push(`- ${item.route} | ~${item.estimatedReceive} ${toToken} | fee $${item.fee} | ETA ${item.etaSeconds}s`);
      }
    }

    if (!options.confirm) {
      lines.push("Quote ready. Confirmation required to execute transfer.");
      return {
        lines,
        needsConfirmation: true,
        executed: false
      };
    }

    const idempotencyKey = createIdempotencyKey(text);
    const quoteId = createQuoteId(fromToken, toToken, String(amount), quote.bestRoute.route);

    const transfer = await client.transfer(
      {
        quoteId,
        recipient,
        amount: String(amount),
        fromToken,
        toToken
      },
      {
        headers: {
          "Idempotency-Key": idempotencyKey
        }
      }
    );

    lines.push(`Transfer submitted. status=${transfer.status} transferId=${transfer.id}`);

    return {
      lines,
      needsConfirmation: false,
      executed: true
    };
  } catch (error) {
    return {
      lines: [formatError(error)],
      needsConfirmation: false,
      executed: false
    };
  }
}

function normalizeExtracted(extracted: Record<string, any>): Record<string, any> {
  const parsed = extracted?.parsed && typeof extracted.parsed === "object" ? extracted.parsed : extracted;

  return {
    ...parsed,
    needsClarification: extracted?.needsClarification ?? false,
    clarificationQuestions: extracted?.clarificationQuestions ?? []
  };
}

export function createIdempotencyKey(input: string): string {
  const digest = crypto.createHash("sha256").update(input).digest("hex").slice(0, 16);
  return `idem_${digest}`;
}

function createQuoteId(fromToken: string, toToken: string, amount: string, route: string): string {
  const normalized = `${fromToken}-${toToken}-${amount}-${route}`;
  const digest = crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 10);
  return `qt_${digest}`;
}

function formatError(error: unknown): string {
  if (error instanceof RailAgentApiError) {
    if (error.code === "POLICY_VIOLATION") {
      const violations = (error.details as any)?.policyDecision?.violations ?? [];
      const details = violations.map((v: any) => v.message).join("; ");
      return `Transfer blocked by policy: ${details || error.message}`;
    }

    if (error.status >= 500) {
      return `RailAgent API unreachable or errored (${error.status}). Please ensure apps/api is running.`;
    }

    return `RailAgent API error (${error.status}): ${error.message}`;
  }

  if (error instanceof TypeError) {
    return "Cannot reach RailAgent API. Start it with: pnpm dev:api";
  }

  return `Unexpected error: ${error instanceof Error ? error.message : String(error)}`;
}
