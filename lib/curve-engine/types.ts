export type RiskProfile =
  | "conservative"
  | "balanced"
  | "aggressive";

export type CurveBand = {
  lowerPrice: number;
  upperPrice: number;

  allocationWeight: number;
  allocationUsd: number;
};

export type StockForgeCurveInput = {
  referencePrice: number;

  annualizedVolatility: number;

  targetRaiseUsd: number;

  graduationThresholdUsd: number;

  riskProfile: RiskProfile;
};

export type StockForgeCurve = {
  version: "sf-v1";

  referencePrice: number;

  initialPrice: number;

  annualizedVolatility: number;

  riskProfile: RiskProfile;

  feeBps: number;

  migrationQuoteThresholdUsd: number;

  targetRaiseUsd: number;

  bands: {
    discovery: CurveBand;

    fairValue: CurveBand;

    expansion: CurveBand;
  };

  metrics: {
    initialDiscountPercent: number;

    fairValueHalfWidthPercent: number;

    discoveryWidthPercent: number;

    expansionWidthPercent: number;
  };

  reasoning: string[];
};