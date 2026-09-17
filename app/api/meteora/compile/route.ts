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
  compileStockForgeToMeteora,
} from "@/lib/meteora/compile-stockforge";

function serialize(
  value: unknown
): unknown {
  if (
    value === null ||
    value === undefined
  ) {
    return value;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (
    typeof value === "bigint"
  ) {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map(
      (item) => serialize(item)
    );
  }

  if (
    typeof value === "object"
  ) {
    const object =
      value as Record<
        string,
        unknown
      >;

    const constructorName =
      (
        value as {
          constructor?: {
            name?: string;
          };
        }
      ).constructor?.name;

    /*
     * Meteora uses BN values
     * throughout ConfigParameters.
     */
    if (
      constructorName === "BN" &&
      typeof (
        value as {
          toString?: (
            radix?: number
          ) => string;
        }
      ).toString ===
        "function"
    ) {
      return (
        value as {
          toString: (
            radix?: number
          ) => string;
        }
      ).toString(10);
    }

    const result: Record<
      string,
      unknown
    > = {};

    for (
      const [
        key,
        childValue,
      ] of Object.entries(
        object
      )
    ) {
      result[key] =
        serialize(childValue);
    }

    return result;
  }

  return String(value);
}

const VALID_RISK_PROFILES:
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
        ) || 365
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

    const graduationTargetUsd =
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

    const leftover =
      Number(
        params.get(
          "leftover"
        ) || 0
      );

    const rawRisk =
      params.get("risk") ||
      "balanced";

    if (
      !VALID_RISK_PROFILES.includes(
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

    const curve =
      compileStockForgeCurve({
        referencePrice,

        annualizedVolatility,

        targetRaiseUsd,

        graduationThresholdUsd:
          graduationTargetUsd,

        riskProfile:
          rawRisk as RiskProfile,
      });

    const meteora =
      compileStockForgeToMeteora(
        curve,
        {
          totalSupply,

          leftover,
        }
      );

    return NextResponse.json({
      stockForge:
        curve,

      meteoraInput: {
        prices:
          meteora.prices,

        sqrtPrices:
          meteora.sqrtPrices.map(
            (value) =>
              value.toString()
          ),

        liquidityWeights:
          meteora.liquidityWeights,

        totalSupply:
          meteora.totalSupply,

        leftover:
          meteora.leftover,

        launchAllocation:
          meteora.launchAllocation,
      },

      meteoraConfig:
        serialize(
          meteora.meteoraConfig
        ),
    });
  } catch (error) {
    console.error(
      "Meteora compilation error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Meteora curve compilation failed.",
      },
      {
        status: 500,
      }
    );
  }
}