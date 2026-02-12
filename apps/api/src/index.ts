import Fastify from "fastify";
import cors from "@fastify/cors";
import {
  ParseIntentRequestSchema,
  ParseIntentResponseSchema,
  QuoteRequestSchema,
  QuoteResponseSchema,
  TransferRequestSchema,
  TransferResponseSchema,
  TransferStatusResponseSchema,
  HealthResponseSchema
} from "@railagent/types";
import { parseIntent } from "@railagent/intent-parser";
import { evaluateTransferPolicy, readTransferPolicyConfig, scoreRoutes } from "@railagent/core";
import { createMentoProviders } from "@railagent/mento-adapter";
import { createWebhookEvent, WebhookDispatcher } from "./webhooks.js";

const app = Fastify({ logger: true });
const port = Number(process.env.PORT ?? 3000);
const webhookSecret = process.env.WEBHOOK_SECRET ?? "dev_webhook_secret";

const providerSelection = createMentoProviders(process.env);
const policyConfig = readTransferPolicyConfig(process.env);
const webhookDispatcher = new WebhookDispatcher(webhookSecret);
const transferStore = new Map<string, { status: "submitted" | "settled" | "failed"; txHash?: string }>();

await app.register(cors, { origin: true });

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

app.post("/intent/parse", async (request, reply) => {
  const parsed = ParseIntentRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid request", details: parsed.error.flatten() });
  }

  const parsedIntent = parseIntent(parsed.data.text);

  return ParseIntentResponseSchema.parse({
    intent: parsedIntent.intent,
    confidence: parsedIntent.confidence,
    extracted: {
      ...parsedIntent.parsed,
      parsed: parsedIntent.parsed,
      needsClarification: parsedIntent.needsClarification,
      clarificationQuestions: parsedIntent.clarificationQuestions
    }
  });
});

app.post("/quote", async (request, reply) => {
  const parsed = QuoteRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid request", details: parsed.error.flatten() });
  }

  const amount = Number(parsed.data.amount);

  const optimized = scoreRoutes({
    sourceCurrency: parsed.data.fromToken,
    targetCurrency: parsed.data.toToken,
    amount: Number.isFinite(amount) ? amount : 0
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

  return QuoteResponseSchema.parse({
    bestRoute: toApiRoute(optimized.bestRoute),
    alternatives: optimized.alternatives.map(toApiRoute),
    explanation: optimized.explanation
  });
});

app.post("/transfer", async (request, reply) => {
  const parsed = TransferRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid request", details: parsed.error.flatten() });
  }

  const idempotencyKey = request.headers["idempotency-key"]?.toString();
  const amount = Number(parsed.data.amount ?? "0");

  const policyDecision = evaluateTransferPolicy(
    {
      amount,
      fromToken: parsed.data.fromToken,
      toToken: parsed.data.toToken,
      recipient: parsed.data.recipient,
      idempotencyKey
    },
    policyConfig
  );

  if (!policyDecision.allowed) {
    return reply.code(422).send({
      error: "Transfer policy denied",
      code: "POLICY_VIOLATION",
      policyDecision
    });
  }

  const execution = await providerSelection.executionProvider.executeTransfer({
    quoteId: parsed.data.quoteId,
    recipient: parsed.data.recipient ?? "",
    amount,
    fromToken: parsed.data.fromToken ?? "",
    toToken: parsed.data.toToken ?? "",
    idempotencyKey: idempotencyKey ?? ""
  });

  transferStore.set(execution.transferId, { status: "submitted", txHash: execution.txHash });

  webhookDispatcher.enqueueEvent(
    createWebhookEvent("transfer.submitted", {
      transferId: execution.transferId,
      quoteId: parsed.data.quoteId,
      provider: execution.provider,
      status: execution.status
    })
  );

  setTimeout(() => {
    transferStore.set(execution.transferId, { status: "settled", txHash: execution.txHash });
    webhookDispatcher.enqueueEvent(
      createWebhookEvent("transfer.settled", {
        transferId: execution.transferId,
        quoteId: parsed.data.quoteId,
        txHash: execution.txHash,
        provider: execution.provider,
        status: "settled"
      })
    );
  }, 50);

  return TransferResponseSchema.parse({
    id: execution.transferId,
    status: "submitted",
    policyDecision: {
      allowed: policyDecision.allowed,
      violations: policyDecision.violations
    },
    provider: {
      name: execution.provider,
      mode: execution.mode,
      fallbackReason: providerSelection.fallbackReason
    }
  });
});

app.get("/transfers/:id", async (request, reply) => {
  const { id } = request.params as { id: string };
  const transfer = transferStore.get(id);

  if (!transfer) {
    return reply.code(404).send({ error: "Transfer not found", code: "TRANSFER_NOT_FOUND" });
  }

  return TransferStatusResponseSchema.parse({
    id,
    status: transfer.status,
    txHash: transfer.txHash
  });
});

app.post("/webhooks/register", async (request, reply) => {
  const body = request.body as { url?: string };

  if (!body?.url) {
    return reply.code(400).send({ error: "url is required", code: "WEBHOOK_URL_REQUIRED" });
  }

  try {
    new URL(body.url);
  } catch {
    return reply.code(400).send({ error: "invalid webhook url", code: "WEBHOOK_URL_INVALID" });
  }

  const target = webhookDispatcher.registerTarget(body.url);
  return reply.code(201).send({ webhook: target });
});

app.get("/webhooks", async () => {
  return { webhooks: webhookDispatcher.listTargets() };
});

app.listen({ port, host: "0.0.0.0" }).then(() => {
  app.log.info(`RailAgent API listening on ${port}`);
});
