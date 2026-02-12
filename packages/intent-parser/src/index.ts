import { z } from "zod";

export type SupportedLanguage = "en" | "es" | "pt" | "fr";
export type ParsedIntentType = "transfer" | "quote" | "unknown";
export type LlmProviderMode = "deterministic" | "openclaw" | "gemini";

export interface ParsedIntentFields {
  amount?: number;
  sourceCurrency?: string;
  targetCurrency?: string;
  recipient?: string;
  destinationHint?: string;
  recipientRelation?: string;
  recurringCadence?: "weekly" | "monthly" | "biweekly";
  language: SupportedLanguage;
  rawText: string;
}

export interface IntentParseResult {
  intent: ParsedIntentType;
  confidence: number;
  parsed: ParsedIntentFields;
  needsClarification: boolean;
  clarificationQuestions: string[];
  provider: LlmProviderMode;
  fallbackReason?: string;
}

export interface ParseIntentRuntimeOptions {
  provider?: string;
  model?: string;
  geminiApiKey?: string;
}

interface IntentNlpProvider {
  mode: LlmProviderMode;
  parse(input: string): Promise<IntentParseResult>;
}

const StructuredExtractionSchema = z.object({
  intent: z.enum(["transfer", "quote", "unknown"]),
  confidence: z.number().min(0).max(1),
  parsed: z.object({
    amount: z.number().positive().optional(),
    sourceCurrency: z.string().min(3).max(6).optional(),
    targetCurrency: z.string().min(3).max(6).optional(),
    recipient: z.string().min(2).optional(),
    destinationHint: z.string().optional(),
    recipientRelation: z.string().optional(),
    recurringCadence: z.enum(["weekly", "biweekly", "monthly"]).optional(),
    language: z.enum(["en", "es", "pt", "fr"]).default("en"),
    rawText: z.string()
  }),
  needsClarification: z.boolean(),
  clarificationQuestions: z.array(z.string())
});

const LANGUAGE_HINTS: Record<SupportedLanguage, string[]> = {
  en: ["send", "transfer", "quote", "how much", "monthly", "mom", "brother"],
  es: ["enviar", "transferir", "cotizacion", "quiero", "mensual", "mama", "hermano"],
  pt: ["enviar", "transferir", "cotacao", "preciso", "mensal", "mae", "irmao"],
  fr: ["envoyer", "transferer", "devis", "mensuel", "maman", "frere", "vers", "donne"]
};

const CURRENCY_ALIASES: Record<string, string> = {
  usd: "USD", eur: "EUR", gbp: "GBP", php: "PHP", ngn: "NGN", kes: "KES",
  dollars: "USD", euro: "EUR", euros: "EUR", pounds: "GBP", naira: "NGN", shillings: "KES", pesos: "PHP",
  "$": "USD", "€": "EUR", "£": "GBP"
};

const RELATION_HINTS = ["mom", "mother", "brother", "sister", "mamá", "mama", "hermano", "mãe", "irmao", "maman", "frere"];

const TYPO_INTENT_HINTS = ["sned", "trasnfer", "enivar", "tranfser", "envair", "deivs", "cotaçao", "cotizasion"];

function normalizeText(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function detectLanguage(text: string): SupportedLanguage {
  const normalized = normalizeText(text);
  let best: SupportedLanguage = "en";
  let bestScore = -1;
  for (const [lang, hints] of Object.entries(LANGUAGE_HINTS) as Array<[SupportedLanguage, string[]]>) {
    const score = hints.reduce((acc, hint) => acc + (normalized.includes(normalizeText(hint)) ? 1 : 0), 0);
    if (score > bestScore) {
      best = lang;
      bestScore = score;
    }
  }
  return best;
}

function parseAmount(text: string): number | undefined {
  const match = text.match(/(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|\d+(?:[.,]\d+)?)/);
  if (!match) return undefined;
  const raw = match[1];
  const normalized = raw.includes(",") && raw.includes(".") ? raw.replace(/,/g, "") : raw.replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseCurrencies(text: string): { sourceCurrency?: string; targetCurrency?: string } {
  const normalized = normalizeText(text);
  const tokens = normalized.split(/[^\p{L}\p{N}€$£]+/u).filter(Boolean);
  const detected = [...new Set(tokens.map((t) => CURRENCY_ALIASES[t]).filter(Boolean))] as string[];

  const pairMatch = normalized.match(/([a-z€$£]{1,6})\s*(?:to|->|a|para|vers|em)\s*([a-z€$£]{1,6})/i);
  if (pairMatch) {
    const source = CURRENCY_ALIASES[pairMatch[1].toLowerCase()];
    const target = CURRENCY_ALIASES[pairMatch[2].toLowerCase()];
    if (source || target) {
      return {
        sourceCurrency: source ?? detected[0],
        targetCurrency: target ?? detected[1]
      };
    }
  }

  return { sourceCurrency: detected[0], targetCurrency: detected[1] };
}

function parseRecipient(text: string): string | undefined {
  const m = text.match(/(?:to|a|para|vers|pour)\s+([@\w.-]{2,}|0x[a-fA-F0-9]{6,})/i);
  return m?.[1];
}

function parseRecurring(text: string): ParsedIntentFields["recurringCadence"] {
  const n = normalizeText(text);
  if (/(monthly|every month|mensual|mensal|mensuel|todo mes)/.test(n)) return "monthly";
  if (/(weekly|semanal|hebdo)/.test(n)) return "weekly";
  if (/(biweekly|quinzenal|cada dos semanas)/.test(n)) return "biweekly";
  return undefined;
}

function parseRelation(text: string): string | undefined {
  const normalized = normalizeText(text);
  return RELATION_HINTS.find((h) => normalized.includes(h));
}

function parseDestinationHint(text: string): string | undefined {
  const n = normalizeText(text);
  if (n.includes("manila") || n.includes("philippines")) return "Philippines";
  if (n.includes("lagos") || n.includes("nigeria")) return "Nigeria";
  if (n.includes("nairobi") || n.includes("kenya")) return "Kenya";
  return undefined;
}

function detectIntent(text: string): ParsedIntentType {
  const n = normalizeText(text);
  const transfer = /(send|transfer|pay|remit|enviar|transferir|envoyer|transferrer|sned|trasnfer|enivar)/.test(n);
  const quote = /(quote|rate|devis|cotizacion|cotacao|cotar|deivs|cotizasion)/.test(n);
  if (transfer && !quote) return "transfer";
  if (quote && !transfer) return "quote";
  if (transfer && quote) return "transfer";
  if (TYPO_INTENT_HINTS.some((t) => n.includes(t))) return "transfer";
  return "unknown";
}

export function parseIntent(input: string): IntentParseResult {
  const language = detectLanguage(input);
  const amount = parseAmount(input);
  const { sourceCurrency, targetCurrency } = parseCurrencies(input);
  const recipient = parseRecipient(input);
  const recurringCadence = parseRecurring(input);
  const recipientRelation = parseRelation(input);
  const destinationHint = parseDestinationHint(input);
  const intent = detectIntent(input);

  const clarificationQuestions: string[] = [];
  let confidence = intent === "unknown" ? 0.25 : 0.62;
  if (amount !== undefined) confidence += 0.1; else clarificationQuestions.push("What amount should I send?");
  if (sourceCurrency) confidence += 0.08; else clarificationQuestions.push("Which currency are you sending from?");
  if (targetCurrency) confidence += 0.08; else clarificationQuestions.push("Which currency should the recipient receive?");
  if (recipient) confidence += 0.08;
  if (destinationHint) confidence += 0.04;
  if (recurringCadence) confidence += 0.04;

  if (intent === "transfer" && !recipient) clarificationQuestions.push("Who should receive the transfer?");
  if (intent === "unknown") clarificationQuestions.unshift("Do you want a transfer or only a quote?");

  return {
    intent,
    confidence: clamp(confidence, 0, 0.98),
    parsed: {
      amount,
      sourceCurrency,
      targetCurrency,
      recipient,
      destinationHint,
      recipientRelation,
      recurringCadence,
      language,
      rawText: input
    },
    needsClarification: clarificationQuestions.length > 0,
    clarificationQuestions,
    provider: "deterministic"
  };
}

function extractionPrompt(input: string): string {
  return [
    "You are a remittance extraction model.",
    "Understand English, Spanish, Portuguese, French, including typos/grammar errors.",
    "Return strict JSON matching schema keys: intent, confidence, parsed, needsClarification, clarificationQuestions.",
    "Include parsed.recurringCadence and parsed.recipientRelation when present.",
    `Input: ${input}`
  ].join("\n");
}

function tryRepairJson(raw: string, input: string): IntentParseResult | undefined {
  const jsonSlice = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonSlice) return undefined;
  try {
    const parsed = JSON.parse(jsonSlice);
    const validated = StructuredExtractionSchema.parse({ ...parsed, parsed: { ...parsed.parsed, rawText: input } });
    return {
      ...validated,
      parsed: {
        ...validated.parsed,
        sourceCurrency: validated.parsed.sourceCurrency?.toUpperCase(),
        targetCurrency: validated.parsed.targetCurrency?.toUpperCase()
      },
      provider: "gemini"
    };
  } catch {
    return undefined;
  }
}

class GeminiProvider implements IntentNlpProvider {
  mode: LlmProviderMode = "gemini";
  constructor(private readonly apiKey: string, private readonly model: string) {}

  async parse(input: string): Promise<IntentParseResult> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: extractionPrompt(input) }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.1 }
        })
      }
    );

    if (!response.ok) throw new Error(`GEMINI_HTTP_${response.status}`);
    const payload = await response.json() as any;
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("GEMINI_EMPTY_RESPONSE");

    try {
      const parsed = JSON.parse(text);
      const validated = StructuredExtractionSchema.parse({ ...parsed, parsed: { ...parsed.parsed, rawText: input } });
      return {
        ...validated,
        parsed: {
          ...validated.parsed,
          sourceCurrency: validated.parsed.sourceCurrency?.toUpperCase(),
          targetCurrency: validated.parsed.targetCurrency?.toUpperCase()
        },
        provider: "gemini"
      };
    } catch {
      const repaired = tryRepairJson(text, input);
      if (!repaired) throw new Error("GEMINI_INVALID_STRUCTURED_OUTPUT");
      return repaired;
    }
  }
}

class OpenClawProvider implements IntentNlpProvider {
  mode: LlmProviderMode = "openclaw";
  async parse(_input: string): Promise<IntentParseResult> {
    throw new Error("OPENCLAW_PROVIDER_UNAVAILABLE");
  }
}

export async function parseIntentWithProvider(input: string, options: ParseIntentRuntimeOptions = {}): Promise<IntentParseResult> {
  const provider = (options.provider ?? process.env.AI_PROVIDER ?? "deterministic").toLowerCase();
  const geminiModel = options.model ?? process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
  const geminiApiKey = options.geminiApiKey ?? process.env.GEMINI_API_KEY;

  try {
    if (provider === "gemini" && geminiApiKey) {
      return await new GeminiProvider(geminiApiKey, geminiModel).parse(input);
    }

    if (provider === "openclaw") {
      return await new OpenClawProvider().parse(input);
    }
  } catch (error) {
    const fallback = parseIntent(input);
    return { ...fallback, fallbackReason: error instanceof Error ? error.message : "PARSE_FAILED" };
  }

  return parseIntent(input);
}
