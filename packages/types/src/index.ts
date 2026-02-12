import { z } from "zod";

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("railagent-api"),
  timestamp: z.string()
});

export const ParseIntentRequestSchema = z.object({
  text: z.string().min(1)
});

export const ParseIntentResponseSchema = z.object({
  intent: z.enum(["transfer", "quote", "unknown"]),
  confidence: z.number().min(0).max(1),
  extracted: z.record(z.any()).default({})
});

export const QuoteRequestSchema = z.object({
  fromToken: z.string().min(1),
  toToken: z.string().min(1),
  amount: z.string().min(1),
  destinationChain: z.string().min(1)
});

export const QuoteAlternativeSchema = z.object({
  route: z.string(),
  estimatedReceive: z.string(),
  fee: z.string(),
  etaSeconds: z.number().int().positive(),
  score: z.number().optional(),
  scoring: z.record(z.any()).optional(),
  metrics: z.record(z.any()).optional()
});

export const QuoteResponseSchema = z.object({
  bestRoute: QuoteAlternativeSchema,
  alternatives: z.array(QuoteAlternativeSchema),
  explanation: z.record(z.any()).optional()
});

export const TransferRequestSchema = z.object({
  quoteId: z.string().min(1),
  recipient: z.string().optional(),
  amount: z.string().optional(),
  fromToken: z.string().optional(),
  toToken: z.string().optional()
});

export const TransferResponseSchema = z.object({
  id: z.string(),
  status: z.literal("submitted"),
  policyDecision: z.object({
    allowed: z.boolean(),
    violations: z.array(
      z.object({
        code: z.string(),
        message: z.string(),
        field: z.string().optional(),
        meta: z.record(z.any()).optional()
      })
    )
  }),
  provider: z.object({
    name: z.string(),
    mode: z.enum(["mock", "live"]),
    fallbackReason: z.string().optional()
  })
});

export const TransferStatusResponseSchema = z.object({
  id: z.string(),
  status: z.enum(["submitted", "settled", "failed"]),
  txHash: z.string().optional()
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type ParseIntentRequest = z.infer<typeof ParseIntentRequestSchema>;
export type ParseIntentResponse = z.infer<typeof ParseIntentResponseSchema>;
export type QuoteRequest = z.infer<typeof QuoteRequestSchema>;
export type QuoteResponse = z.infer<typeof QuoteResponseSchema>;
export type TransferRequest = z.infer<typeof TransferRequestSchema>;
export type TransferResponse = z.infer<typeof TransferResponseSchema>;
export type TransferStatusResponse = z.infer<typeof TransferStatusResponseSchema>;
