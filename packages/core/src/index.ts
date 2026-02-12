export interface CorridorRequest {
  sourceCurrency: string;
  targetCurrency: string;
  amount: number;
}

export interface RouteCandidate {
  id: string;
  route: string;
  rate: number;
  slippageBps: number;
  gasUsd: number;
  etaSec: number;
  liquidityDepth: number;
}

export interface RouteScoreBreakdown {
  weights: {
    rate: number;
    slippageBps: number;
    gasUsd: number;
    etaSec: number;
    liquidityDepth: number;
  };
  normalized: {
    rate: number;
    slippageBps: number;
    gasUsd: number;
    etaSec: number;
    liquidityDepth: number;
  };
  weighted: {
    rate: number;
    slippageBps: number;
    gasUsd: number;
    etaSec: number;
    liquidityDepth: number;
  };
}

export interface ScoredRoute {
  candidate: RouteCandidate;
  score: number;
  estimatedReceive: string;
  fee: string;
  etaSeconds: number;
  breakdown: RouteScoreBreakdown;
}

export interface OptimizedQuote {
  bestRoute: ScoredRoute;
  alternatives: ScoredRoute[];
  explanation: {
    corridor: string;
    strategy: string;
    consideredRoutes: number;
    weights: RouteScoreBreakdown["weights"];
  };
}

export interface LegacyComparison {
  provider: "Western Union" | "Wise";
  estimatedFeeUsd: number;
  estimatedEtaHours: number;
}

export interface FeeComparisonResult {
  corridor: string;
  amount: number;
  railAgentFeeUsd: number;
  legacy: LegacyComparison[];
  legacyAverageFeeUsd: number;
  savingsUsd: number;
  savingsPct: number;
  disclaimer: string;
}

const WEIGHTS = {
  rate: 0.4,
  slippageBps: 0.2,
  gasUsd: 0.15,
  etaSec: 0.1,
  liquidityDepth: 0.15
} as const;

const LEGACY_BASELINES: Record<string, Array<{ maxAmount: number; wuFeeUsd: number; wiseFeeUsd: number; etaHours: number }>> = {
  "USD->PHP": [
    { maxAmount: 100, wuFeeUsd: 8.5, wiseFeeUsd: 4.2, etaHours: 2 },
    { maxAmount: 500, wuFeeUsd: 16, wiseFeeUsd: 8.8, etaHours: 4 },
    { maxAmount: Infinity, wuFeeUsd: 27, wiseFeeUsd: 14.5, etaHours: 8 }
  ],
  "EUR->NGN": [
    { maxAmount: 100, wuFeeUsd: 10, wiseFeeUsd: 5.6, etaHours: 3 },
    { maxAmount: 500, wuFeeUsd: 18.5, wiseFeeUsd: 10.2, etaHours: 6 },
    { maxAmount: Infinity, wuFeeUsd: 31, wiseFeeUsd: 17.5, etaHours: 12 }
  ],
  "GBP->KES": [
    { maxAmount: 100, wuFeeUsd: 9.2, wiseFeeUsd: 4.9, etaHours: 2 },
    { maxAmount: 500, wuFeeUsd: 17.3, wiseFeeUsd: 9.6, etaHours: 5 },
    { maxAmount: Infinity, wuFeeUsd: 29.8, wiseFeeUsd: 16.2, etaHours: 10 }
  ],
  DEFAULT: [
    { maxAmount: 100, wuFeeUsd: 9, wiseFeeUsd: 5, etaHours: 4 },
    { maxAmount: 500, wuFeeUsd: 18, wiseFeeUsd: 10, etaHours: 8 },
    { maxAmount: Infinity, wuFeeUsd: 30, wiseFeeUsd: 17, etaHours: 24 }
  ]
};

function corridorKey(sourceCurrency: string, targetCurrency: string): string {
  return `${sourceCurrency.toUpperCase()}->${targetCurrency.toUpperCase()}`;
}

function getMockCandidatesForCorridor(sourceCurrency: string, targetCurrency: string): RouteCandidate[] {
  const key = corridorKey(sourceCurrency, targetCurrency);

  const data: Record<string, RouteCandidate[]> = {
    "USD->PHP": [
      { id: "r1", route: "celo->mento->gcash", rate: 56.15, slippageBps: 20, gasUsd: 0.11, etaSec: 42, liquidityDepth: 680000 },
      { id: "r2", route: "celo->bridge-x->gcash", rate: 56.0, slippageBps: 15, gasUsd: 0.2, etaSec: 55, liquidityDepth: 720000 },
      { id: "r3", route: "celo->partner-liquidity->bank", rate: 55.9, slippageBps: 12, gasUsd: 0.17, etaSec: 60, liquidityDepth: 750000 }
    ],
    "EUR->NGN": [
      { id: "r4", route: "celo->mento->local-ramp", rate: 1684, slippageBps: 25, gasUsd: 0.12, etaSec: 48, liquidityDepth: 980000 },
      { id: "r5", route: "celo->bridge-x->local-ramp", rate: 1688, slippageBps: 38, gasUsd: 0.22, etaSec: 70, liquidityDepth: 1300000 },
      { id: "r6", route: "celo->otc-partner->local-ramp", rate: 1679, slippageBps: 10, gasUsd: 0.26, etaSec: 90, liquidityDepth: 1700000 }
    ],
    "GBP->KES": [
      { id: "r7", route: "celo->mento->mpesa", rate: 163.8, slippageBps: 16, gasUsd: 0.1, etaSec: 40, liquidityDepth: 760000 },
      { id: "r8", route: "celo->bridge-x->mpesa", rate: 164.0, slippageBps: 30, gasUsd: 0.18, etaSec: 58, liquidityDepth: 980000 },
      { id: "r9", route: "celo->liquidity-hub->bank", rate: 163.2, slippageBps: 8, gasUsd: 0.2, etaSec: 75, liquidityDepth: 1100000 }
    ]
  };

  return data[key] ?? [
    { id: "fallback-1", route: "celo->mento->destination", rate: 1, slippageBps: 20, gasUsd: 0.12, etaSec: 45, liquidityDepth: 100000 }
  ];
}

function normalize(value: number, min: number, max: number, higherIsBetter: boolean): number {
  if (max === min) return 1;
  if (higherIsBetter) {
    return (value - min) / (max - min);
  }
  return (max - value) / (max - min);
}

function estimateReceive(amount: number, candidate: RouteCandidate): string {
  const gross = amount * candidate.rate;
  const slippageLoss = gross * (candidate.slippageBps / 10000);
  const net = Math.max(gross - slippageLoss - candidate.gasUsd, 0);
  return net.toFixed(6);
}

export * from "./policy.js";

export function scoreRoutes(request: CorridorRequest): OptimizedQuote {
  const candidates = getMockCandidatesForCorridor(request.sourceCurrency, request.targetCurrency);

  const rates = candidates.map((c) => c.rate);
  const slippages = candidates.map((c) => c.slippageBps);
  const gasCosts = candidates.map((c) => c.gasUsd);
  const etas = candidates.map((c) => c.etaSec);
  const liquidities = candidates.map((c) => c.liquidityDepth);

  const scored: ScoredRoute[] = candidates.map((candidate) => {
    const normalized = {
      rate: normalize(candidate.rate, Math.min(...rates), Math.max(...rates), true),
      slippageBps: normalize(candidate.slippageBps, Math.min(...slippages), Math.max(...slippages), false),
      gasUsd: normalize(candidate.gasUsd, Math.min(...gasCosts), Math.max(...gasCosts), false),
      etaSec: normalize(candidate.etaSec, Math.min(...etas), Math.max(...etas), false),
      liquidityDepth: normalize(candidate.liquidityDepth, Math.min(...liquidities), Math.max(...liquidities), true)
    };

    const weighted = {
      rate: normalized.rate * WEIGHTS.rate,
      slippageBps: normalized.slippageBps * WEIGHTS.slippageBps,
      gasUsd: normalized.gasUsd * WEIGHTS.gasUsd,
      etaSec: normalized.etaSec * WEIGHTS.etaSec,
      liquidityDepth: normalized.liquidityDepth * WEIGHTS.liquidityDepth
    };

    const score = Number((
      weighted.rate +
      weighted.slippageBps +
      weighted.gasUsd +
      weighted.etaSec +
      weighted.liquidityDepth
    ).toFixed(6));

    return {
      candidate,
      score,
      estimatedReceive: estimateReceive(request.amount, candidate),
      fee: candidate.gasUsd.toFixed(2),
      etaSeconds: candidate.etaSec,
      breakdown: {
        weights: { ...WEIGHTS },
        normalized,
        weighted
      }
    };
  });

  const sorted = scored.sort((a, b) => b.score - a.score);

  return {
    bestRoute: sorted[0],
    alternatives: sorted,
    explanation: {
      corridor: corridorKey(request.sourceCurrency, request.targetCurrency),
      strategy: "weighted-score(rate, slippage, gas, eta, liquidity)",
      consideredRoutes: candidates.length,
      weights: { ...WEIGHTS }
    }
  };
}

export function compareRemittanceFees(input: {
  sourceCurrency: string;
  targetCurrency: string;
  amount: number;
  railAgentFeeUsd: number;
}): FeeComparisonResult {
  const corridor = corridorKey(input.sourceCurrency, input.targetCurrency);
  const table = LEGACY_BASELINES[corridor] ?? LEGACY_BASELINES.DEFAULT;
  const band = table.find((entry) => input.amount <= entry.maxAmount) ?? table[table.length - 1];

  const legacy: LegacyComparison[] = [
    { provider: "Western Union", estimatedFeeUsd: band.wuFeeUsd, estimatedEtaHours: band.etaHours },
    { provider: "Wise", estimatedFeeUsd: band.wiseFeeUsd, estimatedEtaHours: Math.max(1, Math.floor(band.etaHours / 2)) }
  ];

  const legacyAverageFeeUsd = (legacy[0].estimatedFeeUsd + legacy[1].estimatedFeeUsd) / 2;
  const savingsUsd = Number((legacyAverageFeeUsd - input.railAgentFeeUsd).toFixed(2));
  const savingsPct = legacyAverageFeeUsd > 0
    ? Number(((savingsUsd / legacyAverageFeeUsd) * 100).toFixed(2))
    : 0;

  return {
    corridor,
    amount: input.amount,
    railAgentFeeUsd: input.railAgentFeeUsd,
    legacy,
    legacyAverageFeeUsd: Number(legacyAverageFeeUsd.toFixed(2)),
    savingsUsd,
    savingsPct,
    disclaimer: "Fee/time comparisons are estimates from baseline tables, not live third-party quotes."
  };
}
