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

  const text = parsed.data.text.toLowerCase();
  const intent = text.includes("send") || text.includes("transfer") ? "transfer" : text.includes("quote") ? "quote" : "unknown";
  const confidence = intent === "unknown" ? 0.55 : 0.9;

  return ParseIntentResponseSchema.parse({
    intent,
    confidence,
    extracted: { rawText: parsed.data.text }
  });
});

app.post("/quote", async (request, reply) => {
  const parsed = QuoteRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid request", details: parsed.error.flatten() });
  }

  const amount = Number(parsed.data.amount);
  const best = {
    route: "celo->mento->destination",
    estimatedReceive: Number.isFinite(amount) ? (amount * 0.995).toFixed(6) : parsed.data.amount,
    fee: "0.10",
    etaSeconds: 45
  };

  return QuoteResponseSchema.parse({
    bestRoute: best,
    alternatives: [
      best,
      {
        route: "celo->bridge-x->destination",
        estimatedReceive: Number.isFinite(amount) ? (amount * 0.992).toFixed(6) : parsed.data.amount,
        fee: "0.15",
        etaSeconds: 60
      }
    ]
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
