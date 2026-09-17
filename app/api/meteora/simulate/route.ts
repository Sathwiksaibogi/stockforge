import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  compileStockForgeCurve,
} from "@/lib/curve-engine/compiler";

import type {
  RiskProfile,
} from "@/lib/curve-engine/types";

import {
  calibrateStockForgeToMeteora,
} from "@/lib/meteora/calibrate-stockforge";

import {
  simulateStockForgeBuy,
} from "@/lib/meteora/simulate-stockforge";

const VALID_PROFILES:
  RiskProfile[] = [
    "conservative",
    "balanced",
    "aggressive",
  ];

const DEFAULT_AMOUNTS = [
  100,
  1_000,
  5_000,
  10_000,
];

function parseAmounts(
  value: string | null
) {
  if (!value) {
    return DEFAULT_AMOUNTS;
  }

  const amounts =
    value
      .split(",")
      .map((entry) =>
        Number(entry.trim())
      )
      .filter(
        (amount) =>
          Number.isFinite(amount) &&
          amount > 0
      );

  const unique =
    Array.from(
      new Set(amounts)
    );

  /*
   * Prevent abusive / accidental giant
   * simulation batches.
   */
  return unique
    .slice(0, 8);
}

export async function GET(
  request: NextRequest
) {
  try {
    const params =
      request.nextUrl
        .searchParams;

    const referencePrice =
      Number(
        params.get(
          "reference"
        )
      );

    const annualizedVolatility =
      Number(
        params.get(
          "volatility"
        )
      );

    const targetRaiseUsd =
      Number(
        params.get(
          "targetRaise"
        ) ||
          50_000
      );

    const graduationUsd =
      Number(
        params.get(
          "graduation"
        ) ||
          40_000
      );

    const totalSupply =
      Number(
        params.get(
          "supply"
        ) ||
          1_000
      );

    const rawRisk =
      params.get(
        "risk"
      ) ||
      "balanced";

    const slippageBps =
      Number(
        params.get(
          "slippageBps"
        ) ||
          100
      );

    const amounts =
      parseAmounts(
        params.get(
          "amounts"
        )
      );

    if (
      !Number.isFinite(
        referencePrice
      ) ||
      referencePrice <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "A valid reference price is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isFinite(
        annualizedVolatility
      ) ||
      annualizedVolatility < 0
    ) {
      return NextResponse.json(
        {
          error:
            "A valid volatility value is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !VALID_PROFILES.includes(
        rawRisk as RiskProfile
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid risk profile.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      amounts.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "At least one simulation amount is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isFinite(
        slippageBps
      ) ||
      slippageBps < 0 ||
      slippageBps > 5_000
    ) {
      return NextResponse.json(
        {
          error:
            "Slippage must be between 0 and 5000 bps.",
        },
        {
          status: 400,
        }
      );
    }

    const curve =
      compileStockForgeCurve({
        referencePrice,

        annualizedVolatility,

        targetRaiseUsd,

        graduationThresholdUsd:
          graduationUsd,

        riskProfile:
          rawRisk as RiskProfile,
      });

    const calibrated =
      calibrateStockForgeToMeteora(
        curve,
        graduationUsd,
        totalSupply
      );

    const scenarios =
      amounts.map(
        (amount) =>
          simulateStockForgeBuy(
            calibrated,
            curve,
            referencePrice,
            amount,
            slippageBps
            )
      );

    return NextResponse.json({
      market: {
        ticker:
          "TSLA",

        referencePrice,

        annualizedVolatility,

        riskProfile:
          rawRisk,

        feeBps:
          curve.feeBps,
      },

      calibration: {
        requestedGraduationUsd:
          calibrated
            .targetGraduationUsd,

        actualGraduationUsd:
          calibrated
            .actualGraduationUsd,

        totalSupply:
          calibrated
            .totalSupply,

        treasuryLeftoverTokens:
          calibrated
            .leftover,

        launchAllocationTokens:
          calibrated
            .launchAllocationTokens,

        launchAllocationPercent:
          calibrated
            .launchAllocationPercent,

        errorPercent:
          calibrated
            .graduationErrorPercent,

        targetWithinOnePercent:
          calibrated
            .targetWithinOnePercent,
      },

      scenarios,
    });
  } catch (error) {
    console.error(
      "Meteora simulation error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Meteora simulation failed.",
      },
      {
        status: 500,
      }
    );
  }
}