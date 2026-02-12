export type SupportedLanguage = "en" | "es" | "pt" | "fr";
export type ParsedIntentType = "transfer" | "quote" | "unknown";

export interface ParsedIntentFields {
  amount?: number;
  sourceCurrency?: string;
  targetCurrency?: string;
  recipient?: string;
  destinationHint?: string;
  language: SupportedLanguage;
  rawText: string;
}

export interface IntentParseResult {
  intent: ParsedIntentType;
  confidence: number;
  parsed: ParsedIntentFields;
  needsClarification: boolean;
  clarificationQuestions: string[];
}

type LanguageHints = {
  stopwords: string[];
  keywords: string[];
  transferPhrases: string[];
  quotePhrases: string[];
};

const LANGUAGE_HINTS: Record<SupportedLanguage, LanguageHints> = {
  en: {
    stopwords: ["the", "to", "for", "please", "with", "my"],
    keywords: ["send", "transfer", "quote", "rate", "recipient"],
    transferPhrases: ["send", "transfer", "pay", "remit"],
    quotePhrases: ["quote", "rate", "how much", "exchange"]
  },
  es: {
    stopwords: ["el", "la", "para", "por", "con", "mi", "quiero", "necesito"],
    keywords: ["enviar", "transferir", "cotizar", "tasa", "destinatario", "quiero", "hacia"],
    transferPhrases: ["enviar", "transferir", "mandar", "pagar", "quiero enviar"],
    quotePhrases: ["cotizar", "cotización", "tasa", "cambio", "quiero una cotización"]
  },
  pt: {
    stopwords: ["o", "a", "para", "por", "com", "meu", "preciso", "no"],
    keywords: ["enviar", "transferir", "cotação", "taxa", "destinatário", "preciso", "câmbio"],
    transferPhrases: ["enviar", "transferir", "mandar", "pagar", "preciso transferir"],
    quotePhrases: ["cotação", "cotar", "taxa", "câmbio", "qual a cotação"]
  },
  fr: {
    stopwords: ["le", "la", "pour", "avec", "mon", "vers"],
    keywords: ["envoyer", "transférer", "devis", "taux", "destinataire"],
    transferPhrases: ["envoyer", "transférer", "payer", "remettre"],
    quotePhrases: ["devis", "taux", "combien", "change"]
  }
};

const CURRENCY_ALIASES: Record<string, string> = {
  usd: "USD",
  "$": "USD",
  eur: "EUR",
  "€": "EUR",
  gbp: "GBP",
  "£": "GBP",
  php: "PHP",
  ngn: "NGN",
  kes: "KES",
  dollars: "USD",
  euro: "EUR",
  euros: "EUR",
  pounds: "GBP",
  shillings: "KES",
  naira: "NGN",
  pesos: "PHP"
};

const DESTINATION_HINTS: Record<string, string> = {
  philippines: "Philippines",
  manila: "Philippines",
  nigeria: "Nigeria",
  lagos: "Nigeria",
  kenya: "Kenya",
  nairobi: "Kenya"
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function detectLanguage(text: string): SupportedLanguage {
  const normalized = text.toLowerCase();
  const tokens = normalized.split(/[^\p{L}\p{N}€$£]+/u).filter(Boolean);

  let bestLanguage: SupportedLanguage = "en";
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const [language, hints] of Object.entries(LANGUAGE_HINTS) as Array<[SupportedLanguage, LanguageHints]>) {
    let score = 0;

    for (const token of tokens) {
      if (hints.stopwords.includes(token)) score += 1.1;
      if (hints.keywords.includes(token)) score += 2;
    }

    for (const phrase of [...hints.transferPhrases, ...hints.quotePhrases]) {
      if (normalized.includes(phrase)) score += 1.5;
    }

    if (score > bestScore) {
      bestLanguage = language;
      bestScore = score;
    }
  }

  return bestLanguage;
}

function parseAmount(text: string): number | undefined {
  const amountMatch = text.match(/(?:^|\s)(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|\d+(?:[.,]\d+)?)(?:\s|$)/);
  if (!amountMatch) return undefined;

  const raw = amountMatch[1];
  const normalized = raw.includes(",") && raw.includes(".")
    ? raw.replace(/,/g, "")
    : raw.replace(",", ".");

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseCurrencies(text: string): { sourceCurrency?: string; targetCurrency?: string } {
  const normalized = text.toLowerCase();
  const tokens = normalized.split(/[^\p{L}\p{N}€$£]+/u).filter(Boolean);

  const detectedCurrencies = tokens
    .map((token) => CURRENCY_ALIASES[token])
    .filter((value): value is string => Boolean(value));

  const uniq = [...new Set(detectedCurrencies)];

  const pairMatch = normalized.match(/([a-z€$£]{1,6})\s*(?:to|->|a|para|vers|em)\s*([a-z€$£]{1,6})/i);
  if (pairMatch) {
    const source = CURRENCY_ALIASES[pairMatch[1].toLowerCase()];
    const target = CURRENCY_ALIASES[pairMatch[2].toLowerCase()];
    if (source || target) {
      return { sourceCurrency: source ?? uniq[0], targetCurrency: target ?? uniq[1] };
    }
  }

  return {
    sourceCurrency: uniq[0],
    targetCurrency: uniq[1]
  };
}

function parseRecipient(text: string): string | undefined {
  const match = text.match(/(?:to|a|para|vers)\s+([@\w.-]{2,}|0x[a-fA-F0-9]{6,})/i);
  return match?.[1];
}

function parseDestinationHint(text: string): string | undefined {
  const normalized = text.toLowerCase();
  for (const [key, destination] of Object.entries(DESTINATION_HINTS)) {
    if (normalized.includes(key)) return destination;
  }
  return undefined;
}

function detectIntent(text: string, language: SupportedLanguage): ParsedIntentType {
  const normalized = text.toLowerCase();
  const hints = LANGUAGE_HINTS[language];

  const hasTransferSignal = hints.transferPhrases.some((phrase) => normalized.includes(phrase));
  const hasQuoteSignal = hints.quotePhrases.some((phrase) => normalized.includes(phrase));

  if (hasTransferSignal && !hasQuoteSignal) return "transfer";
  if (hasQuoteSignal && !hasTransferSignal) return "quote";
  if (hasTransferSignal && hasQuoteSignal) return "transfer";
  return "unknown";
}

export function parseIntent(input: string): IntentParseResult {
  const language = detectLanguage(input);
  const amount = parseAmount(input);
  const { sourceCurrency, targetCurrency } = parseCurrencies(input);
  const recipient = parseRecipient(input);
  const destinationHint = parseDestinationHint(input);
  const intent = detectIntent(input, language);

  const clarificationQuestions: string[] = [];

  let confidence = intent === "unknown" ? 0.3 : 0.62;

  if (amount !== undefined) confidence += 0.12;
  else clarificationQuestions.push("What amount do you want to transfer?");

  if (sourceCurrency) confidence += 0.08;
  else clarificationQuestions.push("Which source currency should I use?");

  if (targetCurrency) confidence += 0.08;
  else clarificationQuestions.push("Which target currency should the recipient get?");

  if (recipient) confidence += 0.06;
  else if (intent === "transfer") clarificationQuestions.push("Who is the recipient?");

  if (destinationHint) confidence += 0.04;

  if (sourceCurrency && targetCurrency && sourceCurrency === targetCurrency) {
    confidence -= 0.2;
    clarificationQuestions.push("Source and target currencies look the same. Should I convert or keep the same currency?");
  }

  if (intent === "unknown") {
    clarificationQuestions.unshift("Do you want to transfer funds or request a quote?");
  }

  confidence = clamp(confidence, 0, 0.99);

  return {
    intent,
    confidence,
    parsed: {
      amount,
      sourceCurrency,
      targetCurrency,
      recipient,
      destinationHint,
      language,
      rawText: input
    },
    needsClarification: clarificationQuestions.length > 0,
    clarificationQuestions
  };
}
