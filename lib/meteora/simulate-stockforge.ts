import BN from "bn.js";
import Decimal from "decimal.js";

import {
  DynamicBondingCurveClient,
  SwapMode,
} from "@meteora-ag/dynamic-bonding-curve-sdk";

import type {
  SwapQuoteConfig,
} from "@meteora-ag/dynamic-bonding-curve-sdk";

import {
  Connection,
} from "@solana/web3.js";

import {
  SOLANA_RPC_ENDPOINT,
} from "@/lib/solana/cluster";

import type {
  StockForgeCurve,
} from "@/lib/curve-engine/types";

import type {
  CalibratedMeteoraCurve,
} from "./calibrate-stockforge";

import type {
  MarketZoneGuard,
  StockForgeSimulationScenario,
} from "./simulation-types";

const BASE_DECIMALS = 6;
const QUOTE_DECIMALS = 6;

const Q64 =
  new Decimal(2).pow(64);

const connection =
  new Connection(
    SOLANA_RPC_ENDPOINT,
    "confirmed"
  );

const client =
  new DynamicBondingCurveClient(
    connection,
    "confirmed"
  );

function humanToRaw(
  value: number,
  decimals: number
) {
  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new Error(
      "Simulation amount must be positive."
    );
  }

  const raw =
    new Decimal(value)
      .mul(
        new Decimal(10).pow(
          decimals
        )
      )
      .floor();

  return new BN(
    raw.toFixed(0)
  );
}

function rawToHuman(
  value: BN,
  decimals: number
) {
  return new Decimal(
    value.toString()
  )
    .div(
      new Decimal(10).pow(
        decimals
      )
    )
    .toNumber();
}

function sqrtPriceToHumanPrice(
  sqrtPrice: BN
) {
  const sqrtRatio =
    new Decimal(
      sqrtPrice.toString()
    ).div(Q64);

  return sqrtRatio
    .pow(2)
    .toNumber();
}

function percentDifference(
  value: number,
  reference: number
) {
  if (reference === 0) {
    return 0;
  }

  return (
    (value - reference) /
    reference
  ) * 100;
}

function formatDeviation(
  value: number
) {
  const absolute =
    Math.abs(value).toFixed(2);

  if (value < 0) {
    return `${absolute}% below`;
  }

  if (value > 0) {
    return `${absolute}% above`;
  }

  return "at";
}

function getMarketZoneGuard(
  price: number,
  referencePrice: number,
  curve: StockForgeCurve
): MarketZoneGuard {
  const deviation =
    percentDifference(
      price,
      referencePrice
    );

  const fairLower =
    curve.bands.fairValue
      .lowerPrice;

  const fairUpper =
    curve.bands.fairValue
      .upperPrice;

  const expansionUpper =
    curve.bands.expansion
      .upperPrice;

  /*
   * Discovery:
   *
   * initial launch price
   *        →
   * fair-value lower boundary
   */
  if (
    price >=
      curve.initialPrice &&
    price < fairLower
  ) {
    return {
      zone: "discovery",

      label:
        "Discovery zone",

      message:
        `The market remains in its intentional launch-discovery region, ${formatDeviation(
          deviation
        )} the Pyth reference price.`,
    };
  }

  /*
   * Fair-value region:
   *
   * volatility-adjusted region around
   * the external reference market.
   */
  if (
    price >= fairLower &&
    price <= fairUpper
  ) {
    return {
      zone: "fairValue",

      label:
        "Fair-value zone",

      message:
        `The post-trade curve price is inside StockForge's volatility-adjusted reference region and is ${formatDeviation(
          deviation
        )} the Pyth market price.`,
    };
  }

  /*
   * Expansion:
   *
   * Market has moved above the
   * fair-value region but remains
   * inside the designed curve.
   */
  if (
    price > fairUpper &&
    price <= expansionUpper
  ) {
    return {
      zone: "expansion",

      label:
        "Expansion zone",

      message:
        `The trade moves the market into StockForge's expansion region, ${formatDeviation(
          deviation
        )} the Pyth reference. Liquidity is intentionally thinner here.`,
    };
  }

  return {
    zone: "outside",

    label:
      "Outside designed range",

    message:
      `The resulting price is outside the StockForge-designed market range and is ${formatDeviation(
        deviation
      )} the Pyth reference. Review the trade size or curve configuration.`,
  };
}

function createQuoteConfig(
  calibrated:
    CalibratedMeteoraCurve
): SwapQuoteConfig {
  const config =
    calibrated.meteoraConfig;

  return {
    poolFees:
      config.poolFees,

    collectFeeMode:
      config.collectFeeMode,

    sqrtStartPrice:
      config.sqrtStartPrice,

    migrationQuoteThreshold:
      config.migrationQuoteThreshold,

    curve:
      config.curve,
  };
}

export function simulateStockForgeBuy(
  calibrated:
    CalibratedMeteoraCurve,

  curve:
    StockForgeCurve,

  referencePrice: number,

  inputUsd: number,

  slippageBps = 100
): StockForgeSimulationScenario {
  const amountIn =
    humanToRaw(
      inputUsd,
      QUOTE_DECIMALS
    );

  const quoteConfig =
    createQuoteConfig(
      calibrated
    );

  /*
   * false = quote → base
   *
   * Investor spends USDC and receives
   * StockForge launch tokens.
   */
  const quote =
    client.pool
      .getQuoteFromInputAmount({
        config:
          quoteConfig,

        swapBaseForQuote:
          false,

        amountIn,

        swapMode:
          SwapMode.ExactIn,

        slippageBps,

        hasReferral:
          false,

        eligibleForFirstSwapWithMinFee:
          false,
      });

  const consumedUsd =
    rawToHuman(
      quote
        .includedFeeInputAmount,
      QUOTE_DECIMALS
    );

  const amountLeftUsd =
    rawToHuman(
      quote.amountLeft,
      QUOTE_DECIMALS
    );

  const tokensOut =
    rawToHuman(
      quote.outputAmount,
      BASE_DECIMALS
    );

  /*
   * Meteora allows minimumAmountOut
   * to be undefined.
   *
   * Derive the slippage-protected
   * minimum ourselves when necessary.
   */
  const minimumAmountOutRaw =
    quote.minimumAmountOut ??
    quote.outputAmount
      .muln(
        10_000 -
          slippageBps
      )
      .divn(10_000);

  const minimumTokensOut =
    rawToHuman(
      minimumAmountOutRaw,
      BASE_DECIMALS
    );

  const tradingFeeUsd =
    rawToHuman(
      quote.tradingFee,
      QUOTE_DECIMALS
    );

  const protocolFeeUsd =
    rawToHuman(
      quote.protocolFee,
      QUOTE_DECIMALS
    );

  const referralFeeUsd =
    rawToHuman(
      quote.referralFee,
      QUOTE_DECIMALS
    );

  const startCurvePrice =
    sqrtPriceToHumanPrice(
      quoteConfig.sqrtStartPrice
    );

  const endCurvePrice =
    sqrtPriceToHumanPrice(
      quote.nextSqrtPrice
    );

  const averageExecutionPrice =
    tokensOut > 0
      ? consumedUsd /
        tokensOut
      : 0;

  const executionImpactPercent =
    averageExecutionPrice > 0
      ? percentDifference(
          averageExecutionPrice,
          startCurvePrice
        )
      : 0;

  const curveMovePercent =
    percentDifference(
      endCurvePrice,
      startCurvePrice
    );

  const referencePremiumBeforePercent =
    percentDifference(
      startCurvePrice,
      referencePrice
    );

  const referencePremiumAfterPercent =
    percentDifference(
      endCurvePrice,
      referencePrice
    );

  const marketZoneGuard =
    getMarketZoneGuard(
      endCurvePrice,
      referencePrice,
      curve
    );

  return {
    inputUsd,

    consumedUsd,

    amountLeftUsd,

    tokensOut,

    minimumTokensOut,

    averageExecutionPrice,

    startCurvePrice,

    endCurvePrice,

    executionImpactPercent,

    curveMovePercent,

    referencePremiumBeforePercent,

    referencePremiumAfterPercent,

    tradingFeeUsd,

    protocolFeeUsd,

    referralFeeUsd,

    marketZoneGuard,
  };
}