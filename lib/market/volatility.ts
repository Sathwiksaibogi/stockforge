export type VolatilityRegime =
  | "low"
  | "moderate"
  | "high"
  | "extreme";

export type VolatilityMetrics = {
  observations: number;
  dailyVolatility: number;
  annualizedVolatility: number;
  annualizedVolatilityPercent: number;
  regime: VolatilityRegime;
};

export function calculateAnnualizedVolatility(
  closes: number[]
): VolatilityMetrics {
  if (closes.length < 3) {
    throw new Error(
      "At least three closing prices are required."
    );
  }

  const logReturns: number[] = [];

  for (let index = 1; index < closes.length; index++) {
    const previous = closes[index - 1];
    const current = closes[index];

    if (
      previous <= 0 ||
      current <= 0 ||
      !Number.isFinite(previous) ||
      !Number.isFinite(current)
    ) {
      continue;
    }

    logReturns.push(
      Math.log(current / previous)
    );
  }

  if (logReturns.length < 2) {
    throw new Error(
      "Not enough valid returns to calculate volatility."
    );
  }

  const mean =
    logReturns.reduce(
      (sum, value) => sum + value,
      0
    ) / logReturns.length;

  const variance =
    logReturns.reduce((sum, value) => {
      const difference = value - mean;

      return sum + difference ** 2;
    }, 0) /
    (logReturns.length - 1);

  const dailyVolatility =
    Math.sqrt(variance);

  /*
   * Standard market convention:
   * approximately 252 equity trading days/year.
   */
  const annualizedVolatility =
    dailyVolatility * Math.sqrt(252);

  return {
    observations: logReturns.length,

    dailyVolatility,

    annualizedVolatility,

    annualizedVolatilityPercent:
      annualizedVolatility * 100,

    regime: classifyVolatility(
      annualizedVolatility
    ),
  };
}

export function classifyVolatility(
  annualizedVolatility: number
): VolatilityRegime {
  if (annualizedVolatility < 0.2) {
    return "low";
  }

  if (annualizedVolatility < 0.4) {
    return "moderate";
  }

  if (annualizedVolatility < 0.7) {
    return "high";
  }

  return "extreme";
}