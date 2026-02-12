import crypto from "node:crypto";
import Fastify from "fastify";
import cors from "@fastify/cors";
import {
  AgentMessageRequestSchema,
  AgentMessageResponseSchema,
  ParseIntentRequestSchema,
  ParseIntentResponseSchema,
  QuoteRequestSchema,
  QuoteResponseSchema,
  TransferRequestSchema,
  TransferResponseSchema,
  TransferStatusResponseSchema,
  HealthResponseSchema
} from "@railagent/types";
import { parseIntentWithProvider } from "@railagent/intent-parser";
import { compareRemittanceFees, evaluateTransferPolicy, readTransferPolicyConfig, scoreRoutes } from "@railagent/core";
import { createMentoProviders } from "@railagent/mento-adapter";
import { createWebhookEvent, WebhookDispatcher } from "./webhooks.js";
import {
  ApiError,
  assertApiKey,
  enforceRateLimit,
  requestIdentity,
  sanitizeForAudit,
  sendApiError,
  verifyWebhookSignature
} from "./security.js";

interface AgentSessionState {
  language?: string;
  lastRecipient?: string;
  preferredCorridor?: string;
  recurringPreference?: string;
  pendingQuote?: { fromToken: string; toToken: string; amount: number; recipient?: string; route: string };
}

const app = Fastify({ logger: true });
const port = Number(process.env.PORT ?? 3000);
const webhookSecret = process.env.WEBHOOK_SECRET ?? "dev_webhook_secret";
const writeApiKeys = (process.env.API_WRITE_KEYS ?? "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);
const rateLimitPerMin = Number(process.env.RATE_LIMIT_PER_MIN ?? "60");
const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? "60000");

const providerSelection = createMentoProviders(process.env);
const policyConfig = readTransferPolicyConfig(process.env);
const webhookDispatcher = new WebhookDispatcher(webhookSecret);
const transferStore = new Map<string, { status: "submitted" | "settled" | "failed"; txHash?: string }>();
const agentSessions = new Map<string, AgentSessionState>();

await app.register(cors, { origin: true });

app.setErrorHandler((error, _request, reply) => {
  sendApiError(reply, error);
});

app.addHook("onRequest", async (request, reply) => {
  const correlationId = request.id;
  reply.header("x-correlation-id", correlationId);

  const identity = requestIdentity(request);
  const rate = enforceRateLimit(`${identity}:${request.url}`, rateLimitPerMin, rateLimitWindowMs);
  reply.header("x-ratelimit-remaining", String(rate.remaining));
  reply.header("x-ratelimit-reset", String(Math.floor(rate.resetAt / 1000)));

  if (!rate.allowed) {
    throw new ApiError(429, "RATE_LIMITED", "Too many requests");
  }

  app.log.info({ correlationId, path: request.url, method: request.method, identity }, "request.received");
});

app.addHook("onClose", async () => {
  webhookDispatcher.stop();
});

app.get("/health", async () => {
  return HealthResponseSchema.parse({
    status: "ok",
    service: "railagent-api",
    timestamp: new Date().toISOString()
  });
});

app.post("/intent/parse", async (request) => {
  const parsed = ParseIntentRequestSchema.safeParse(request.body);
  if (!parsed.success) throw new ApiError(400, "VALIDATION_ERROR", "Invalid request", parsed.error.flatten());

  const parsedIntent = await parseIntentWithProvider(parsed.data.text, {
    provider: process.env.AI_PROVIDER,
    model: process.env.AI_MODEL,
    geminiApiKey: process.env.GEMINI_API_KEY
  });

  return ParseIntentResponseSchema.parse({
    intent: parsedIntent.intent,
    confidence: parsedIntent.confidence,
    extracted: {
      ...parsedIntent.parsed,
      parsed: parsedIntent.parsed,
      needsClarification: parsedIntent.needsClarification,
      clarificationQuestions: parsedIntent.clarificationQuestions,
      provider: parsedIntent.provider,
      fallbackReason: parsedIntent.fallbackReason
    }
  });
});

app.post("/quote", async (request) => {
  const parsed = QuoteRequestSchema.safeParse(request.body);
  if (!parsed.success) throw new ApiError(400, "VALIDATION_ERROR", "Invalid request", parsed.error.flatten());

  const amount = Number(parsed.data.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new ApiError(422, "INVALID_AMOUNT", "amount must be a positive number-like string");

  const optimized = scoreRoutes({
    sourceCurrency: parsed.data.fromToken,
    targetCurrency: parsed.data.toToken,
    amount
  });

  const toApiRoute = (item: (typeof optimized.alternatives)[number]) => ({
    route: item.candidate.route,
    estimatedReceive: item.estimatedReceive,
    fee: item.fee,
    etaSeconds: item.etaSeconds,
    score: item.score,
    scoring: item.breakdown,
    metrics: {
      rate: item.candidate.rate,
      slippageBps: item.candidate.slippageBps,
      gasUsd: item.candidate.gasUsd,
      liquidityDepth: item.candidate.liquidityDepth
    }
  });

  const comparison = compareRemittanceFees({
    sourceCurrency: parsed.data.fromToken,
    targetCurrency: parsed.data.toToken,
    amount,
    railAgentFeeUsd: Number(optimized.bestRoute.fee)
  });

  return QuoteResponseSchema.parse({
    bestRoute: toApiRoute(optimized.bestRoute),
    alternatives: optimized.alternatives.map(toApiRoute),
    explanation: optimized.explanation,
    comparison
  });
});

app.post("/agent/message", async (request) => {
  const parsed = AgentMessageRequestSchema.safeParse(request.body);
  if (!parsed.success) throw new ApiError(400, "VALIDATION_ERROR", "Invalid request", parsed.error.flatten());

  const session = agentSessions.get(parsed.data.sessionId) ?? {};
  const parsedIntent = await parseIntentWithProvider(parsed.data.text, {
    provider: process.env.AI_PROVIDER,
    model: process.env.AI_MODEL,
    geminiApiKey: process.env.GEMINI_API_KEY
  });

  session.language = parsedIntent.parsed.language;
  if (parsedIntent.parsed.recipient) session.lastRecipient = parsedIntent.parsed.recipient;
  if (parsedIntent.parsed.recurringCadence) session.recurringPreference = parsedIntent.parsed.recurringCadence;

  const wantsCheapest = /cheapest|menos caro|mais barato|moins cher/i.test(parsed.data.text);

  const amount = parsedIntent.parsed.amount;
  const fromToken = parsedIntent.parsed.sourceCurrency;
  const toToken = parsedIntent.parsed.targetCurrency;
  const recipient = parsedIntent.parsed.recipient ?? session.lastRecipient;

  if (parsedIntent.needsClarification || !amount || !fromToken || !toToken) {
    const qs = [...parsedIntent.clarificationQuestions];
    if (!recipient && parsedIntent.intent === "transfer") qs.push("Who should receive this transfer?");
    const response = {
      sessionId: parsed.data.sessionId,
      assistantResponse: `I can help with that. ${qs.join(" ")}`.trim(),
      actionState: "clarify" as const,
      confidence: parsedIntent.confidence,
      memory: {
        language: session.language,
        lastRecipient: session.lastRecipient,
        preferredCorridor: session.preferredCorridor,
        recurringPreference: session.recurringPreference
      }
    };
    agentSessions.set(parsed.data.sessionId, session);
    return AgentMessageResponseSchema.parse(response);
  }

  const optimized = scoreRoutes({ sourceCurrency: fromToken, targetCurrency: toToken, amount });
  const sorted = wantsCheapest
    ? [...optimized.alternatives].sort((a, b) => Number(a.fee) - Number(b.fee))
    : optimized.alternatives;
  const bestRoute = sorted[0];

  const quote = {
    bestRoute: {
      route: bestRoute.candidate.route,
      estimatedReceive: bestRoute.estimatedReceive,
      fee: bestRoute.fee,
      etaSeconds: bestRoute.etaSeconds,
      score: bestRoute.score,
      scoring: bestRoute.breakdown,
      metrics: {
        rate: bestRoute.candidate.rate,
        slippageBps: bestRoute.candidate.slippageBps,
        gasUsd: bestRoute.candidate.gasUsd,
        liquidityDepth: bestRoute.candidate.liquidityDepth
      }
    },
    alternatives: sorted.map((item) => ({
      route: item.candidate.route,
      estimatedReceive: item.estimatedReceive,
      fee: item.fee,
      etaSeconds: item.etaSeconds,
      score: item.score,
      scoring: item.breakdown,
      metrics: {
        rate: item.candidate.rate,
        slippageBps: item.candidate.slippageBps,
        gasUsd: item.candidate.gasUsd,
        liquidityDepth: item.candidate.liquidityDepth
      }
    })),
    explanation: optimized.explanation
  };

  const comparison = compareRemittanceFees({
    sourceCurrency: fromToken,
    targetCurrency: toToken,
    amount,
    railAgentFeeUsd: Number(quote.bestRoute.fee)
  });

  session.preferredCorridor = `${fromToken}->${toToken}`;
  session.pendingQuote = { fromToken, toToken, amount, recipient, route: quote.bestRoute.route };
  agentSessions.set(parsed.data.sessionId, session);

  if (!parsed.data.confirm) {
    const relation = parsedIntent.parsed.recipientRelation ? ` (${parsedIntent.parsed.recipientRelation})` : "";
    const recurring = session.recurringPreference ? ` Recurring preference: ${session.recurringPreference}.` : "";

    return AgentMessageResponseSchema.parse({
      sessionId: parsed.data.sessionId,
      assistantResponse:
        `Plan (${Math.round(parsedIntent.confidence * 100)}% confidence): send ${amount} ${fromToken} to ${recipient}${relation}, receiving about ${quote.bestRoute.estimatedReceive} ${toToken} via ${quote.bestRoute.route}. ` +
        `RailAgent fee ~$${quote.bestRoute.fee}; legacy average ~$${comparison.legacyAverageFeeUsd} (save ~$${comparison.savingsUsd}, ${comparison.savingsPct}%). ${comparison.disclaimer}${recurring} Confirm to execute.`,
      actionState: "quoted",
      confidence: parsedIntent.confidence,
      quote: { ...quote, comparison },
      comparison,
      memory: {
        language: session.language,
        lastRecipient: session.lastRecipient,
        preferredCorridor: session.preferredCorridor,
        recurringPreference: session.recurringPreference
      }
    });
  }

  const idempotencyKey = `idem_${crypto.createHash("sha256").update(`${parsed.data.sessionId}:${parsed.data.text}`).digest("hex").slice(0, 16)}`;
  const policyDecision = evaluateTransferPolicy(
    { amount, fromToken, toToken, recipient, idempotencyKey },
    policyConfig
  );
  if (!policyDecision.allowed) throw new ApiError(422, "POLICY_VIOLATION", "Transfer policy denied", { policyDecision });

  const quoteId = `qt_${crypto.createHash("sha256").update(`${fromToken}-${toToken}-${amount}-${quote.bestRoute.route}`).digest("hex").slice(0, 10)}`;
  const execution = await providerSelection.executionProvider.executeTransfer({
    quoteId,
    recipient: recipient ?? "",
    amount,
    fromToken,
    toToken,
    idempotencyKey
  });

  transferStore.set(execution.transferId, { status: "submitted", txHash: execution.txHash });

  const transfer = {
    id: execution.transferId,
    status: "submitted" as const,
    policyDecision: { allowed: true, violations: [] },
    provider: { name: execution.provider, mode: execution.mode, fallbackReason: providerSelection.fallbackReason }
  };

  return AgentMessageResponseSchema.parse({
    sessionId: parsed.data.sessionId,
    assistantResponse: `Transfer submitted on Celo rail. transferId=${execution.transferId} status=submitted`,
    actionState: "executed",
    confidence: parsedIntent.confidence,
    quote: { ...quote, comparison },
    comparison,
    transfer,
    memory: {
      language: session.language,
      lastRecipient: session.lastRecipient,
      preferredCorridor: session.preferredCorridor,
      recurringPreference: session.recurringPreference
    }
  });
});

app.post("/transfer", async (request) => {
  assertApiKey(request, writeApiKeys);
  const parsed = TransferRequestSchema.safeParse(request.body);
  if (!parsed.success) throw new ApiError(400, "VALIDATION_ERROR", "Invalid request", parsed.error.flatten());

  const idempotencyKey = request.headers["idempotency-key"]?.toString();
  const amount = Number(parsed.data.amount ?? "0");

  const policyDecision = evaluateTransferPolicy({
    amount,
    fromToken: parsed.data.fromToken,
    toToken: parsed.data.toToken,
    recipient: parsed.data.recipient,
    idempotencyKey
  }, policyConfig);

  app.log.info({ event: "audit.transfer_policy", correlationId: request.id, payload: sanitizeForAudit(policyDecision) }, "audit");

  if (!policyDecision.allowed) throw new ApiError(422, "POLICY_VIOLATION", "Transfer policy denied", { policyDecision });

  const execution = await providerSelection.executionProvider.executeTransfer({
    quoteId: parsed.data.quoteId,
    recipient: parsed.data.recipient ?? "",
    amount,
    fromToken: parsed.data.fromToken ?? "",
    toToken: parsed.data.toToken ?? "",
    idempotencyKey: idempotencyKey ?? ""
  });

  transferStore.set(execution.transferId, { status: "submitted", txHash: execution.txHash });

  webhookDispatcher.enqueueEvent(createWebhookEvent("transfer.submitted", {
    transferId: execution.transferId,
    quoteId: parsed.data.quoteId,
    provider: execution.provider,
    status: execution.status
  }));

  setTimeout(() => {
    transferStore.set(execution.transferId, { status: "settled", txHash: execution.txHash });
    webhookDispatcher.enqueueEvent(createWebhookEvent("transfer.settled", {
      transferId: execution.transferId,
      quoteId: parsed.data.quoteId,
      txHash: execution.txHash,
      provider: execution.provider,
      status: "settled"
    }));
  }, 50);

  return TransferResponseSchema.parse({
    id: execution.transferId,
    status: "submitted",
    policyDecision: { allowed: policyDecision.allowed, violations: policyDecision.violations },
    provider: { name: execution.provider, mode: execution.mode, fallbackReason: providerSelection.fallbackReason }
  });
});

app.get("/transfers/:id", async (request) => {
  const { id } = request.params as { id: string };
  const transfer = transferStore.get(id);
  if (!transfer) throw new ApiError(404, "TRANSFER_NOT_FOUND", "Transfer not found");

  return TransferStatusResponseSchema.parse({ id, status: transfer.status, txHash: transfer.txHash });
});

app.post("/webhooks/register", async (request, reply) => {
  assertApiKey(request, writeApiKeys);
  const body = request.body as { url?: string };
  if (!body?.url) throw new ApiError(400, "WEBHOOK_URL_REQUIRED", "url is required");
  try { new URL(body.url); } catch { throw new ApiError(400, "WEBHOOK_URL_INVALID", "invalid webhook url"); }
  const target = webhookDispatcher.registerTarget(body.url);
  return reply.code(201).send({ webhook: target });
});

app.get("/webhooks", async () => ({
  webhooks: webhookDispatcher.listTargets(),
  consumerVerification: {
    headers: ["x-railagent-signature", "x-railagent-timestamp"],
    helper: "verifyWebhookSignature(secret, timestamp + '.' + rawBody)"
  }
}));

app.post("/webhooks/verify", async (request) => {
  const body = request.body as { payload: string; signature?: string; timestamp?: string };
  return verifyWebhookSignature({ secret: webhookSecret, payload: body.payload, signature: body.signature, timestamp: body.timestamp });
});

app.listen({ port, host: "0.0.0.0" }).then(() => {
  app.log.info(`RailAgent API listening on ${port}`);
});
