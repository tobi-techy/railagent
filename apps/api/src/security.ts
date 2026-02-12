import crypto from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function assertApiKey(request: FastifyRequest, allowedKeys: string[]): void {
  if (allowedKeys.length === 0) return;
  const key = request.headers["x-api-key"]?.toString();
  if (!key || !allowedKeys.includes(key)) {
    throw new ApiError(401, "UNAUTHORIZED", "Valid API key required");
  }
}

export interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitBucket>();

export function enforceRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const existing = rateLimitStore.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  existing.count += 1;
  rateLimitStore.set(key, existing);
  if (existing.count > limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  return { allowed: true, remaining: Math.max(0, limit - existing.count), resetAt: existing.resetAt };
}

export function requestIdentity(request: FastifyRequest): string {
  const apiKey = request.headers["x-api-key"]?.toString();
  if (apiKey) return `key:${apiKey.slice(0, 6)}`;
  const ip = request.ip || "unknown";
  return `ip:${ip}`;
}

export function verifyWebhookSignature({
  secret,
  payload,
  signature,
  timestamp,
  toleranceSec = 300
}: {
  secret: string;
  payload: string;
  signature?: string;
  timestamp?: string;
  toleranceSec?: number;
}): { ok: boolean; reason?: string } {
  if (!signature || !timestamp) return { ok: false, reason: "MISSING_HEADERS" };
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: "INVALID_TIMESTAMP" };

  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - ts) > toleranceSec) return { ok: false, reason: "TIMESTAMP_OUTSIDE_TOLERANCE" };

  const signedPayload = `${timestamp}.${payload}`;
  const expected = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
  const expectedBuf = Buffer.from(expected);
  const sigBuf = Buffer.from(signature);

  if (expectedBuf.length !== sigBuf.length || !crypto.timingSafeEqual(expectedBuf, sigBuf)) {
    return { ok: false, reason: "INVALID_SIGNATURE" };
  }

  return { ok: true };
}

export function sanitizeForAudit(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    if (value.length > 120) return `${value.slice(0, 120)}...`;
    if (/key|secret|token|private/i.test(value)) return "[REDACTED]";
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => sanitizeForAudit(item));
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(([k, v]) => {
      if (/key|secret|token|signature|private/i.test(k)) return [k, "[REDACTED]"];
      return [k, sanitizeForAudit(v)];
    });
    return Object.fromEntries(entries);
  }
  return value;
}

export function sendApiError(reply: FastifyReply, error: unknown): void {
  if (error instanceof ApiError) {
    reply.code(error.statusCode).send({
      error: error.message,
      code: error.code,
      details: error.details
    });
    return;
  }

  reply.code(500).send({
    error: "Internal server error",
    code: "INTERNAL_ERROR"
  });
}
