export type MarketZone =
  | "discovery"
  | "fairValue"
  | "expansion"
  | "outside";

export type MarketZoneGuard = {
  zone: MarketZone;

  label: string;

  message: string;
};

export type StockForgeSimulationScenario = {
  inputUsd: number;

  consumedUsd: number;

  amountLeftUsd: number;

  tokensOut: number;

  minimumTokensOut: number;

  averageExecutionPrice: number;

  startCurvePrice: number;

  endCurvePrice: number;

  executionImpactPercent: number;

  curveMovePercent: number;

  referencePremiumBeforePercent: number;

  referencePremiumAfterPercent: number;

  tradingFeeUsd: number;

  protocolFeeUsd: number;

  referralFeeUsd: number;

  marketZoneGuard: MarketZoneGuard;
};

export type StockForgeSimulationResponse = {
  market: {
    ticker: string;

    referencePrice: number;

    annualizedVolatility: number;

    riskProfile:
      | "conservative"
      | "balanced"
      | "aggressive";

    feeBps: number;
  };

  calibration: {
    requestedGraduationUsd: number;

    actualGraduationUsd: number;

    totalSupply: number;

    treasuryLeftoverTokens: number;

    launchAllocationTokens: number;

    launchAllocationPercent: number;

    errorPercent: number;

    targetWithinOnePercent: boolean;
  };

  scenarios: StockForgeSimulationScenario[];
};