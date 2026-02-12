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
import { scoreRoutes } from "@railagent/core";

const app = Fastify({ logger: true });
const port = Number(process.env.PORT ?? 3000);

await app.register(cors, { origin: true });

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

  const id = `tr_${Math.random().toString(36).slice(2, 10)}`;
  return TransferResponseSchema.parse({ id, status: "submitted" });
});

app.get("/transfers/:id", async (request) => {
  const { id } = request.params as { id: string };
  return TransferStatusResponseSchema.parse({
    id,
    status: "settled",
    txHash: `0x${"ab".repeat(32)}`
  });
});

app.listen({ port, host: "0.0.0.0" }).then(() => {
  app.log.info(`RailAgent API listening on ${port}`);
});
