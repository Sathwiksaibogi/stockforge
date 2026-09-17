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

const VALID_PROFILES:
  RiskProfile[] = [
    "conservative",
    "balanced",
    "aggressive",
  ];

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
        ) || 364.76
      );

    const annualizedVolatility =
      Number(
        params.get(
          "volatility"
        ) || 0.446
      );

    const targetRaiseUsd =
      Number(
        params.get(
          "targetRaise"
        ) || 50_000
      );

    const graduationUsd =
      Number(
        params.get(
          "graduation"
        ) || 40_000
      );

    const totalSupply =
      Number(
        params.get(
          "supply"
        ) || 1_000
      );

    const rawRisk =
      params.get("risk") ||
      "balanced";

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

    const stockForgeCurve =
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
        stockForgeCurve,
        graduationUsd,
        totalSupply
      );

    return NextResponse.json({
      stockForge: {
        referencePrice:
          stockForgeCurve
            .referencePrice,

        initialPrice:
          stockForgeCurve
            .initialPrice,

        annualizedVolatility:
          stockForgeCurve
            .annualizedVolatility,

        riskProfile:
          stockForgeCurve
            .riskProfile,

        feeBps:
          stockForgeCurve
            .feeBps,
      },

      calibration: {
        requestedGraduationUsd:
          calibrated
            .targetGraduationUsd,

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

        actualGraduationUsd:
          calibrated
            .actualGraduationUsd,

        errorUsd:
          calibrated
            .graduationErrorUsd,

        errorPercent:
          calibrated
            .graduationErrorPercent,

        targetWithinOnePercent:
          calibrated
            .targetWithinOnePercent,
      },

      meteora: {
        migrationQuoteThresholdRaw:
          calibrated
            .meteoraConfig
            .migrationQuoteThreshold
            .toString(),

        prices:
          calibrated
            .prices,

        sqrtPrices:
          calibrated
            .sqrtPrices
            .map(
              (value) =>
                value.toString()
            ),

        liquidityWeights:
          calibrated
            .liquidityWeights,
      },
    });
  } catch (error) {
    console.error(
      "StockForge calibration error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Meteora calibration failed.",
      },
      {
        status: 500,
      }
    );
  }
}