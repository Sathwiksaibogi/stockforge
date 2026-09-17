import {
  ActivationType,
  BaseFeeMode,
  CollectFeeMode,
  MigrationFeeOption,
  MigrationOption,
  TokenAuthorityOption,
  TokenDecimal,
  TokenType,
  buildCurveWithCustomSqrtPrices,
  getSqrtPriceFromPrice,
} from "@meteora-ag/dynamic-bonding-curve-sdk";

import type {
  StockForgeCurve,
} from "@/lib/curve-engine/types";

export type StockForgeMeteoraInput = {
  totalSupply: number;
  leftover?: number;
};

export function compileStockForgeToMeteora(
  curve: StockForgeCurve,
  input: StockForgeMeteoraInput
) {
  if (
    !Number.isFinite(input.totalSupply) ||
    input.totalSupply <= 0
  ) {
    throw new Error(
      "Total token supply must be positive."
    );
  }

  const totalSupply =
    Math.floor(input.totalSupply);

  const leftover =
    Math.floor(input.leftover ?? 0);

  if (
    leftover < 0 ||
    leftover >= totalSupply
  ) {
    throw new Error(
      "Leftover must be zero or greater and less than total supply."
    );
  }

  /*
   * Four human-readable price boundaries
   * define three DBC liquidity regions:
   *
   * 1. Discovery
   * 2. Fair value
   * 3. Expansion
   */
  const prices = [
    curve.initialPrice,

    curve.bands.fairValue
      .lowerPrice,

    curve.bands.fairValue
      .upperPrice,

    curve.bands.expansion
      .upperPrice,
  ];

  /*
   * Meteora requires strictly increasing
   * curve boundaries.
   */
  for (
    let index = 1;
    index < prices.length;
    index++
  ) {
    if (
      prices[index] <=
      prices[index - 1]
    ) {
      throw new Error(
        "StockForge prices must be strictly ascending before Meteora compilation."
      );
    }
  }

  /*
   * Meteora SDK v1.5.12 expects Q64
   * sqrt prices rather than normal USD
   * price values.
   */
  const sqrtPrices =
    prices.map((price) =>
      getSqrtPriceFromPrice(
        price.toString(),
        TokenDecimal.SIX,
        TokenDecimal.SIX
      )
    );

  /*
   * Convert StockForge's normalized
   * allocation values into relative
   * Meteora liquidity weights.
   *
   * Example:
   * 0.22 / 0.58 / 0.20
   * becomes:
   * 22 / 58 / 20
   */
  const liquidityWeights = [
    Math.max(
      1,
      Math.round(
        curve.bands.discovery
          .allocationWeight *
          100
      )
    ),

    Math.max(
      1,
      Math.round(
        curve.bands.fairValue
          .allocationWeight *
          100
      )
    ),

    Math.max(
      1,
      Math.round(
        curve.bands.expansion
          .allocationWeight *
          100
      )
    ),
  ];

  if (
    liquidityWeights.length !==
    sqrtPrices.length - 1
  ) {
    throw new Error(
      "Liquidity weights must equal sqrtPrices.length - 1."
    );
  }

  const meteoraConfig =
    buildCurveWithCustomSqrtPrices({
      token: {
        tokenType:
          TokenType.SPLToken,

        tokenBaseDecimal:
          TokenDecimal.SIX,

        /*
         * Planned quote asset: USDC.
         */
        tokenQuoteDecimal:
          TokenDecimal.SIX,

        tokenAuthorityOption:
          TokenAuthorityOption.Immutable,

        totalTokenSupply:
          totalSupply,

        /*
         * Tokens not distributed through
         * the initial DBC phase.
         */
        leftover,
      },

      fee: {
        baseFeeParams: {
          baseFeeMode:
            BaseFeeMode
              .FeeSchedulerLinear,

          feeSchedulerParam: {
            /*
             * StockForge already calculates
             * this fee from market volatility.
             *
             * Same start/end value means
             * effectively constant base fee.
             */
            startingFeeBps:
              curve.feeBps,

            endingFeeBps:
              curve.feeBps,

            numberOfPeriod: 0,

            totalDuration: 0,
          },
        },

        dynamicFeeEnabled:
          false,

        collectFeeMode:
          CollectFeeMode.QuoteToken,

        creatorTradingFeePercentage:
          100,

        poolCreationFee:
          0,

        enableFirstSwapWithMinFee:
          false,
      },

      migration: {
        migrationOption:
          MigrationOption.MET_DAMM_V2,

        migrationFeeOption:
          MigrationFeeOption.FixedBps25,

        migrationFee: {
          feePercentage:
            0,

          creatorFeePercentage:
            0,
        },
      },

      /*
       * Post-migration LP distribution.
       *
       * Total = 100%.
       */
      liquidityDistribution: {
        partnerLiquidityPercentage:
          0,

        partnerPermanentLockedLiquidityPercentage:
          0,

        creatorLiquidityPercentage:
          90,

        creatorPermanentLockedLiquidityPercentage:
          10,
      },

      lockedVesting: {
        totalLockedVestingAmount:
          0,

        numberOfVestingPeriod:
          0,

        cliffUnlockAmount:
          0,

        totalVestingDuration:
          0,

        cliffDurationFromMigrationTime:
          0,
      },

      activationType:
        ActivationType.Timestamp,

      sqrtPrices,

      liquidityWeights,
    });

  return {
    prices,

    sqrtPrices,

    liquidityWeights,

    totalSupply,

    leftover,

    launchAllocation:
      totalSupply - leftover,

    meteoraConfig,
  };
}