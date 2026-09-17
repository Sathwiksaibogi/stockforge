import {
  CURVE_PROFILES,
} from "./profiles";

import type {
  CurveBand,
  StockForgeCurve,
  StockForgeCurveInput,
} from "./types";

function clamp(
  value: number,
  min: number,
  max: number
) {
  return Math.min(
    Math.max(value, min),
    max
  );
}

function roundPrice(
  value: number
) {
  return Number(value.toFixed(4));
}

function roundMoney(
  value: number
) {
  return Number(value.toFixed(2));
}

function roundPercent(
  value: number
) {
  return Number(
    (value * 100).toFixed(2)
  );
}

function validateInput(
  input: StockForgeCurveInput
) {
  if (
    !Number.isFinite(
      input.referencePrice
    ) ||
    input.referencePrice <= 0
  ) {
    throw new Error(
      "Reference price must be positive."
    );
  }

  if (
    !Number.isFinite(
      input.annualizedVolatility
    ) ||
    input.annualizedVolatility < 0
  ) {
    throw new Error(
      "Volatility must be a valid non-negative number."
    );
  }

  if (
    !Number.isFinite(
      input.targetRaiseUsd
    ) ||
    input.targetRaiseUsd <= 0
  ) {
    throw new Error(
      "Target raise must be positive."
    );
  }

  if (
    !Number.isFinite(
      input.graduationThresholdUsd
    ) ||
    input.graduationThresholdUsd <= 0
  ) {
    throw new Error(
      "Graduation threshold must be positive."
    );
  }

  if (
    input.graduationThresholdUsd >
    input.targetRaiseUsd
  ) {
    throw new Error(
      "Graduation threshold cannot exceed target raise."
    );
  }
}

function createBand(
  lowerPrice: number,
  upperPrice: number,
  allocationWeight: number,
  targetRaiseUsd: number
): CurveBand {
  return {
    lowerPrice:
      roundPrice(lowerPrice),

    upperPrice:
      roundPrice(upperPrice),

    allocationWeight,

    allocationUsd:
      roundMoney(
        targetRaiseUsd *
          allocationWeight
      ),
  };
}

export function compileStockForgeCurve(
  input: StockForgeCurveInput
): StockForgeCurve {
  validateInput(input);

  const profile =
    CURVE_PROFILES[
      input.riskProfile
    ];

  /*
   * Prevent extremely unusual volatility
   * observations from generating unusable
   * launch parameters.
   *
   * 5%  = low-vol floor
   * 125% = extreme-vol ceiling
   */
  const normalizedVolatility =
    clamp(
      input.annualizedVolatility,
      0.05,
      1.25
    );

  /*
   * FAIR VALUE REGION
   *
   * Higher volatility means a wider
   * acceptable discovery area around the
   * external reference market.
   */
  const fairValueHalfWidth =
    profile.fairValueBaseWidth +
    normalizedVolatility *
      profile.fairValueVolatilityFactor;

  /*
   * DISCOVERY REGION
   *
   * Exists below the fair-value region.
   */
  const discoveryWidth =
    profile.discoveryBaseWidth +
    normalizedVolatility *
      profile.discoveryVolatilityFactor;

  /*
   * EXPANSION REGION
   *
   * Allows the market to trade above the
   * reference area while progressively
   * moving into thinner liquidity.
   */
  const expansionWidth =
    profile.expansionBaseWidth +
    normalizedVolatility *
      profile.expansionVolatilityFactor;

  const reference =
    input.referencePrice;

  const fairValueLower =
    reference *
    (1 - fairValueHalfWidth);

  const fairValueUpper =
    reference *
    (1 + fairValueHalfWidth);

  const discoveryLower =
    reference *
    (
      1 -
      fairValueHalfWidth -
      discoveryWidth
    );

  const discoveryUpper =
    fairValueLower;

  const expansionLower =
    fairValueUpper;

  const expansionUpper =
    reference *
    (
      1 +
      fairValueHalfWidth +
      expansionWidth
    );

  /*
   * Initial launch price sits inside the
   * discovery region instead of exactly at
   * its floor.
   */
  const initialPrice =
  discoveryLower;

  /*
   * Volatility-aware fee.
   *
   * More volatile markets receive slightly
   * higher fees because LP inventory risk is
   * greater.
   *
   * Risk profile then makes a small
   * adjustment.
   */
  const volatilityFee =
    Math.round(
      25 +
        normalizedVolatility * 75
    );

  const feeBps =
    clamp(
      volatilityFee +
        profile.feeAdjustmentBps,
      20,
      125
    );

  const discoveryBand =
    createBand(
      discoveryLower,
      discoveryUpper,
      profile.liquidityWeights
        .discovery,
      input.targetRaiseUsd
    );

  const fairValueBand =
    createBand(
      fairValueLower,
      fairValueUpper,
      profile.liquidityWeights
        .fairValue,
      input.targetRaiseUsd
    );

  const expansionBand =
    createBand(
      expansionLower,
      expansionUpper,
      profile.liquidityWeights
        .expansion,
      input.targetRaiseUsd
    );

  const initialDiscount =
    1 -
    initialPrice /
      reference;

  return {
    version: "sf-v1",

    referencePrice:
      roundPrice(reference),

    initialPrice:
      roundPrice(initialPrice),

    annualizedVolatility:
      input.annualizedVolatility,

    riskProfile:
      input.riskProfile,

    feeBps,

    migrationQuoteThresholdUsd:
      roundMoney(
        input.graduationThresholdUsd
      ),

    targetRaiseUsd:
      roundMoney(
        input.targetRaiseUsd
      ),

    bands: {
      discovery:
        discoveryBand,

      fairValue:
        fairValueBand,

      expansion:
        expansionBand,
    },

    metrics: {
      initialDiscountPercent:
        roundPercent(
          initialDiscount
        ),

      fairValueHalfWidthPercent:
        roundPercent(
          fairValueHalfWidth
        ),

      discoveryWidthPercent:
        roundPercent(
          discoveryWidth
        ),

      expansionWidthPercent:
        roundPercent(
          expansionWidth
        ),
    },

    reasoning: [
      `Reference price is $${reference.toFixed(
        2
      )}.`,

      `Annualized realized volatility is ${(
        input.annualizedVolatility *
        100
      ).toFixed(2)}%.`,

      `The ${input.riskProfile} profile allocates ${(
        profile.liquidityWeights
          .fairValue * 100
      ).toFixed(
        0
      )}% of launch capital around the fair-value region.`,

      `Volatility-adjusted trading fee is ${feeBps} bps.`,

      `The issuer targets graduation near $${input.graduationThresholdUsd.toLocaleString()}; Meteora derives the final quote threshold from the compiled DBC curve.`,
    ],
  };
}