import Decimal from "decimal.js";

import type {
  StockForgeCurve,
} from "@/lib/curve-engine/types";

import {
  compileStockForgeToMeteora,
} from "./compile-stockforge";

const QUOTE_DECIMALS = 6;

const SDK_GRANULARITY_ERROR =
  "leftOverDelta must be less than totalLeftover";

type MeteoraCompilation =
  ReturnType<
    typeof compileStockForgeToMeteora
  >;

type Candidate = {
  leftover: number;

  thresholdUsd: number;

  result: MeteoraCompilation;

  absoluteError: number;
};

export type CalibratedMeteoraCurve =
  MeteoraCompilation & {
    targetGraduationUsd: number;

    actualGraduationUsd: number;

    graduationErrorUsd: number;

    graduationErrorPercent: number;

    targetWithinOnePercent: boolean;

    launchAllocationTokens: number;

    launchAllocationPercent: number;
  };

function getMigrationThresholdUsd(
  result: MeteoraCompilation
) {
  const rawThreshold =
    result.meteoraConfig
      .migrationQuoteThreshold
      .toString();

  return new Decimal(
    rawThreshold
  )
    .div(
      new Decimal(10).pow(
        QUOTE_DECIMALS
      )
    )
    .toNumber();
}

function isGranularityConstraint(
  error: unknown
) {
  return (
    error instanceof Error &&
    error.message.includes(
      SDK_GRANULARITY_ERROR
    )
  );
}

export function calibrateStockForgeToMeteora(
  curve: StockForgeCurve,
  targetGraduationUsd: number,
  totalSupply = 1_000
): CalibratedMeteoraCurve {
  if (
    !Number.isFinite(
      targetGraduationUsd
    ) ||
    targetGraduationUsd <= 0
  ) {
    throw new Error(
      "Graduation target must be positive."
    );
  }

  if (
    !Number.isFinite(totalSupply) ||
    totalSupply <= 1
  ) {
    throw new Error(
      "Total token supply must be greater than one."
    );
  }

  const normalizedSupply =
    Math.floor(totalSupply);

  const maxLeftover =
    normalizedSupply - 1;

  const cache = new Map<
    number,
    Candidate | null
  >();

  let best: Candidate | null =
    null;

  function evaluate(
    requestedLeftover: number
  ): Candidate | null {
    const leftover =
      Math.min(
        maxLeftover,
        Math.max(
          0,
          Math.floor(
            requestedLeftover
          )
        )
      );

    const cached =
      cache.get(leftover);

    if (cached !== undefined) {
      return cached;
    }

    try {
      const result =
        compileStockForgeToMeteora(
          curve,
          {
            totalSupply:
              normalizedSupply,

            leftover,
          }
        );

      const thresholdUsd =
        getMigrationThresholdUsd(
          result
        );

      const candidate: Candidate = {
        leftover,

        thresholdUsd,

        result,

        absoluteError:
          Math.abs(
            thresholdUsd -
              targetGraduationUsd
          ),
      };

      cache.set(
        leftover,
        candidate
      );

      if (
        best === null ||
        candidate.absoluteError <
          best.absoluteError
      ) {
        best = candidate;
      }

      return candidate;
    } catch (error) {
      /*
       * Some launch allocations are too
       * small for Meteora's integer /
       * migration granularity.
       *
       * We skip only this known constraint.
       */
      if (
        isGranularityConstraint(
          error
        )
      ) {
        cache.set(
          leftover,
          null
        );

        return null;
      }

      throw error;
    }
  }

  /*
   * PASS 1:
   * Coarse search across the entire
   * possible leftover range.
   *
   * For totalSupply = 1000:
   *
   * 0, 10, 20 ... 990
   */
  const coarseStep =
    Math.max(
      1,
      Math.floor(
        normalizedSupply / 100
      )
    );

  for (
    let leftover = 0;
    leftover <= maxLeftover;
    leftover += coarseStep
  ) {
    evaluate(leftover);
  }

  /*
   * Evaluate maximum explicitly because
   * maxLeftover might not align perfectly
   * with coarseStep.
   */
  evaluate(maxLeftover);

  const coarseBestCandidate =
    best as Candidate | null;

  if (
    coarseBestCandidate === null
  ) {
    throw new Error(
      "No valid Meteora launch allocation was found."
    );
  }

  const coarseBest =
    coarseBestCandidate.leftover;

  /*
   * PASS 2:
   * Search every integer leftover value
   * near the best coarse result.
   */
  const refineStart =
    Math.max(
      0,
      coarseBest -
        coarseStep * 2
    );

  const refineEnd =
    Math.min(
      maxLeftover,
      coarseBest +
        coarseStep * 2
    );

  for (
    let leftover =
      refineStart;
    leftover <= refineEnd;
    leftover++
  ) {
    evaluate(leftover);
  }

  const finalBest =
    best as Candidate | null;

  if (
    finalBest === null
  ) {
    throw new Error(
      "Meteora graduation calibration failed."
    );
  }

  return buildResult(
    finalBest,
    targetGraduationUsd,
    normalizedSupply
  );
}

function buildResult(
  candidate: Candidate,
  targetGraduationUsd: number,
  totalSupply: number
): CalibratedMeteoraCurve {
  const graduationErrorUsd =
    candidate.thresholdUsd -
    targetGraduationUsd;

  const graduationErrorPercent =
    (
      graduationErrorUsd /
      targetGraduationUsd
    ) *
    100;

  const launchAllocationTokens =
    totalSupply -
    candidate.leftover;

  const launchAllocationPercent =
    (
      launchAllocationTokens /
      totalSupply
    ) *
    100;

  return {
    ...candidate.result,

    targetGraduationUsd,

    actualGraduationUsd:
      candidate.thresholdUsd,

    graduationErrorUsd,

    graduationErrorPercent,

    targetWithinOnePercent:
      Math.abs(
        graduationErrorPercent
      ) <= 1,

    launchAllocationTokens,

    launchAllocationPercent,
  };
}