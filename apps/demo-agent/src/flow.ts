import { RailAgentApiError, RailAgentSdk } from "@railagent/sdk-ts";

export interface AgentResult {
  lines: string[];
  needsConfirmation: boolean;
  executed: boolean;
}

export interface RunAgentOptions {
  confirm: boolean;
  sessionId: string;
}

export interface DemoAgentClient {
  agentMessage(payload: { sessionId: string; text: string; confirm?: boolean }): Promise<{
    assistantResponse: string;
    actionState: "clarify" | "quoted" | "confirmed" | "executed";
    confidence: number;
    comparison?: { savingsUsd: number; savingsPct: number; disclaimer: string };
    quote?: { bestRoute: { route: string; estimatedReceive: string; fee: string; etaSeconds: number } };
    transfer?: { id: string; status: string };
  }>;
}

export function createClient(baseUrl: string): DemoAgentClient {
  const sdk = new RailAgentSdk({ baseUrl });
  return {
    agentMessage: (payload) => sdk.agentMessage(payload)
  };
}

export async function runAgentFlow(client: DemoAgentClient, text: string, options: RunAgentOptions): Promise<AgentResult> {
  try {
    const response = await client.agentMessage({ sessionId: options.sessionId, text, confirm: options.confirm });
    const lines = [response.assistantResponse];

    if (response.quote?.bestRoute) {
      lines.push(
        `Top route: ${response.quote.bestRoute.route} | receive ~${response.quote.bestRoute.estimatedReceive} | fee $${response.quote.bestRoute.fee} | ETA ${response.quote.bestRoute.etaSeconds}s`
      );
    }

    if (response.comparison) {
      lines.push(`Savings vs legacy est.: $${response.comparison.savingsUsd} (${response.comparison.savingsPct}%).`);
      lines.push(response.comparison.disclaimer);
    }

    if (response.transfer) {
      lines.push(`Transfer submitted. status=${response.transfer.status} transferId=${response.transfer.id}`);
    }

    return {
      lines,
      needsConfirmation: response.actionState === "quoted",
      executed: response.actionState === "executed"
    };
  } catch (error) {
    return {
      lines: [formatError(error)],
      needsConfirmation: false,
      executed: false
    };
  }
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
