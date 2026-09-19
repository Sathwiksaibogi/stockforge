"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  useSearchParams,
} from "next/navigation";

import Link from "next/link";

import {
  DeployMarketButton,
} from "@/components/deployment/deploy-market-button";

import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  Gauge,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";



import {
  usePythPrice,
} from "@/hooks/use-pyth-price";

import {
  useMeteoraSimulation,
} from "@/hooks/use-meteora-simulation";

import type {
  StockForgeSimulationScenario,
} from "@/lib/meteora/simulation-types";

import {
  PYTH_EQUITY_FEEDS,
  type PythEquityTicker,
  isPythEquityTicker,
} from "@/lib/pyth/feeds";

const PRESETS = [
  100,
  1_000,
  5_000,
  10_000,
];

type RiskProfile =
  | "conservative"
  | "balanced"
  | "aggressive";

function money(
  value: number,
  digits = 2
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",

      minimumFractionDigits:
        digits,

      maximumFractionDigits:
        digits,
    }
  ).format(value);
}

function percent(
  value: number
) {
  const sign =
    value > 0
      ? "+"
      : "";

  return `${sign}${value.toFixed(
    2
  )}%`;
}

function validRisk(
  value: string | null
): value is RiskProfile {
  return (
    value ===
      "conservative" ||
    value ===
      "balanced" ||
    value ===
      "aggressive"
  );
}

export function SimulationClient() {
  const searchParams =
    useSearchParams();

  

  const snapshot =
    useMemo(() => {
      const tickerParam =
        searchParams.get(
          "ticker"
        );

      const referencePrice =
        Number(
          searchParams.get(
            "reference"
          )
        );

      const annualizedVolatility =
        Number(
          searchParams.get(
            "volatility"
          )
        );

      const targetRaiseUsd =
        Number(
          searchParams.get(
            "targetRaise"
          )
        );

      const graduationUsd =
        Number(
          searchParams.get(
            "graduation"
          )
        );

      const totalSupply =
        Number(
          searchParams.get(
            "supply"
          )
        );

      const risk =
        searchParams.get(
          "risk"
        );

      const capturedAt =
        Number(
          searchParams.get(
            "snapshot"
          )
        );

      if (
        !tickerParam ||
        !isPythEquityTicker(
          tickerParam
        ) ||
        !Number.isFinite(
          referencePrice
        ) ||
        referencePrice <= 0 ||
        !Number.isFinite(
          annualizedVolatility
        ) ||
        annualizedVolatility <
          0 ||
        !Number.isFinite(
          targetRaiseUsd
        ) ||
        targetRaiseUsd <= 0 ||
        !Number.isFinite(
          graduationUsd
        ) ||
        graduationUsd <= 0 ||
        !Number.isFinite(
          totalSupply
        ) ||
        totalSupply <= 1 ||
        !validRisk(risk)
      ) {
        return null;
      }

      return {
        ticker:
          tickerParam,

        referencePrice,

        annualizedVolatility,

        targetRaiseUsd,

        graduationUsd,

        totalSupply,

        riskProfile:
          risk,

        capturedAt:
          Number.isFinite(
            capturedAt
          )
            ? capturedAt
            : null,
      };
    }, [searchParams]);

  /*
   * Pyth stays live here ONLY for
   * comparison with the frozen
   * compile snapshot.
   *
   * It does not reconstruct the
   * proposed DBC.
   */
  const liveTicker =
    snapshot?.ticker ??
    "TSLA";

  const {
    data: livePrice,
  } =
    usePythPrice(
      liveTicker
    );

  const [
    selectedAmount,
    setSelectedAmount,
  ] =
    useState(
      1_000
    );

  const simulationParams =
    useMemo(() => {
      if (!snapshot) {
        return null;
      }

      return {
        referencePrice:
          snapshot
            .referencePrice,

        annualizedVolatility:
          snapshot
            .annualizedVolatility,

        targetRaiseUsd:
          snapshot
            .targetRaiseUsd,

        graduationUsd:
          snapshot
            .graduationUsd,

        totalSupply:
          snapshot
            .totalSupply,

        riskProfile:
          snapshot
            .riskProfile,

        amounts:
          PRESETS,

        slippageBps:
          100,
      };
    }, [
      snapshot,
    ]);

  const {
    data:
      simulation,

    loading,

    error,

    refresh,
  } =
    useMeteoraSimulation(
      simulationParams
    );

  const scenario =
    simulation
      ?.scenarios.find(
        (item) =>
          item.inputUsd ===
          selectedAmount
      ) ??
    null;

  const liveReferenceMove =
    snapshot &&
    livePrice
      ? (
          (
            livePrice.price -
            snapshot.referencePrice
          ) /
          snapshot.referencePrice
        ) *
        100
      : null;

  if (!snapshot) {
    return (
      <main className="min-h-screen bg-[#07090c] text-white">
        

        <div className="mx-auto max-w-3xl px-6 pt-40">
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-8">
            <AlertTriangle className="h-6 w-6 text-amber-300" />

            <h1 className="mt-5 text-2xl font-semibold">
              No compiled market
              snapshot
            </h1>

            <p className="mt-3 text-sm leading-6 text-zinc-500">
              Build a StockForge curve
              first so the exact Pyth
              reference and issuer
              configuration can be
              frozen for simulation.
            </p>

            <Link
              href="/create"
              className="mt-6 inline-flex rounded-xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-black"
            >
              Build market
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07090c] text-white">
      

      <div className="mx-auto max-w-7xl px-6 pb-24 pt-36 lg:px-8">
        <Link
          href="/create"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />

          Back to curve
        </Link>

        <div className="mt-8 max-w-3xl">
          <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.18em] text-emerald-400">
            <Activity className="h-4 w-4" />

            Meteora pre-launch simulator
          </div>

          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
            Stress-test the {snapshot.ticker}
            market before deployment.
          </h1>

          <p className="mt-5 max-w-2xl leading-7 text-zinc-400">
            The DBC below is frozen
            from the issuer&apos;s
            {" "}{snapshot.ticker} Pyth snapshot.
            Current Pyth prices continue
            updating independently.
          </p>
        </div>

        <section className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric
            icon={
              TrendingUp
            }
            label="Compiled reference"
            value={money(
              snapshot
                .referencePrice
            )}
            detail={`Frozen Pyth ${snapshot.ticker} snapshot`}
          />

          <Metric
            icon={
              Activity
            }
            label="Current Pyth"
            value={
              livePrice
                ? money(
                    livePrice.price
                  )
                : "Loading..."
            }
            detail={
              liveReferenceMove !==
              null
                ? `${percent(
                    liveReferenceMove
                  )} since compile`
                : `Live ${snapshot.ticker} comparison`
            }
          />

          <Metric
            icon={
              Gauge
            }
            label="30D volatility"
            value={`${(
              snapshot
                .annualizedVolatility *
              100
            ).toFixed(
              2
            )}%`}
            detail="Frozen realized volatility"
          />

          <Metric
            icon={
              CircleDollarSign
            }
            label="Graduation target"
            value={money(
              snapshot
                .graduationUsd
            )}
            detail="Issuer objective"
          />
        </section>

        {error && (
          <div className="mt-8 rounded-2xl border border-red-400/20 bg-red-400/[0.06] p-5 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading &&
          !simulation && (
            <div className="mt-8 flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-[#0d1014] p-6 text-sm text-zinc-500">
              <RefreshCw className="h-4 w-4 animate-spin" />

              Running Meteora
              pre-pool simulation...
            </div>
          )}

        {simulation && (
          <>
            <section className="mt-8 grid gap-4 md:grid-cols-3">
              <Metric
                icon={
                  BarChart3
                }
                label="Actual graduation"
                value={money(
                  simulation
                    .calibration
                    .actualGraduationUsd
                )}
                detail={`${simulation.calibration.errorPercent.toFixed(
                  3
                )}% calibration error`}
              />

              <Metric
                icon={
                  ShieldCheck
                }
                label="Launch allocation"
                value={`${simulation.calibration.launchAllocationTokens} tokens`}
                detail={`${simulation.calibration.launchAllocationPercent.toFixed(
                  1
                )}% of supply`}
              />

              <Metric
                icon={
                  CircleDollarSign
                }
                label="Treasury leftover"
                value={`${simulation.calibration.treasuryLeftoverTokens} tokens`}
                detail="Outside initial DBC"
              />
            </section>

            <div className="mt-8 grid gap-8 xl:grid-cols-[0.72fr_1.28fr]">
              <section className="rounded-[26px] border border-white/[0.07] bg-[#0d1014] p-6">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-600">
                  Scenario
                </p>

                <h2 className="mt-3 text-xl font-medium">
                  Investor purchase
                </h2>

                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  Select a USDC trade
                  size and run it through
                  Meteora&apos;s actual
                  pre-pool quote engine.
                </p>

                <div className="mt-7 grid grid-cols-2 gap-3">
                  {PRESETS.map(
                    (amount) => {
                      const selected =
                        amount ===
                        selectedAmount;

                      return (
                        <button
                          key={
                            amount
                          }
                          type="button"
                          onClick={() =>
                            setSelectedAmount(
                              amount
                            )
                          }
                          className={`rounded-xl border px-4 py-4 text-left transition ${
                            selected
                              ? "border-emerald-400/30 bg-emerald-400/[0.08]"
                              : "border-white/[0.07] bg-black/20 hover:bg-white/[0.03]"
                          }`}
                        >
                          <p className="text-xs text-zinc-600">
                            Buy
                          </p>

                          <p className="mt-1 text-lg font-medium">
                            {money(
                              amount,
                              0
                            )}
                          </p>
                        </button>
                      );
                    }
                  )}
                </div>

                <div className="mt-8 border-t border-white/[0.06] pt-6">
                  <p className="text-xs text-zinc-600">
                    Frozen configuration
                  </p>

                  <div className="mt-4 space-y-3 text-sm">
                    <Row
                      label="Reference asset"
                      value={`${snapshot.ticker} · ${PYTH_EQUITY_FEEDS[snapshot.ticker].name}`}
                    />

                    <Row
                      label="Risk profile"
                      value={
                        snapshot
                          .riskProfile
                      }
                    />

                    <Row
                      label="Trading fee"
                      value={`${simulation.market.feeBps} bps`}
                    />

                    <Row
                      label="Total supply"
                      value={`${snapshot.totalSupply}`}
                    />

                    <Row
                      label="Target raise"
                      value={money(
                        snapshot
                          .targetRaiseUsd
                      )}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    void refresh()
                  }
                  className="mt-7 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] text-sm text-zinc-300 transition hover:bg-white/[0.04]"
                >
                  <RefreshCw className="h-4 w-4" />

                  Re-run quote
                </button>
              </section>

              <section className="rounded-[26px] border border-white/[0.07] bg-[#0d1014] p-6 sm:p-8">
                {scenario ? (
                  <QuotePanel
                    scenario={scenario}
                    snapshot={snapshot}
                    />
                ) : (
                  <div className="flex min-h-[400px] items-center justify-center text-sm text-zinc-600">
                    Select a scenario.
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function QuotePanel({
  scenario,
  snapshot,
}: {
  scenario: StockForgeSimulationScenario;

  snapshot: {
    ticker: PythEquityTicker;
    referencePrice: number;
    annualizedVolatility: number;
    targetRaiseUsd: number;
    graduationUsd: number;
    totalSupply: number;
    riskProfile: RiskProfile;
  };
}) {
  const guard =
    scenario.marketZoneGuard;

  const guardStyles = {
    discovery:
      "border-amber-400/20 bg-amber-400/[0.06] text-amber-300",

    fairValue:
      "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300",

    expansion:
      "border-blue-400/20 bg-blue-400/[0.06] text-blue-300",

    outside:
      "border-red-400/20 bg-red-400/[0.06] text-red-300",
  };

  return (
    <>
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-emerald-400">
            Meteora quote
          </p>

          <h2 className="mt-3 text-2xl font-medium">
            {money(
              scenario.inputUsd,
              0
            )}{" "}
            purchase
          </h2>
        </div>

        <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-300">
          PRE-POOL
        </div>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <QuoteMetric
          label="Tokens received"
          value={scenario.tokensOut.toFixed(
            4
          )}
          detail={`Minimum ${scenario.minimumTokensOut.toFixed(
            4
          )}`}
        />

        <QuoteMetric
          label="Average execution"
          value={money(
            scenario.averageExecutionPrice
          )}
          detail="USDC / token"
        />

        <QuoteMetric
          label="Start curve price"
          value={money(
            scenario.startCurvePrice
          )}
        />

        <QuoteMetric
          label="Post-trade price"
          value={money(
            scenario.endCurvePrice
          )}
          detail={`${percent(
            scenario.curveMovePercent
          )} curve movement`}
        />

        <QuoteMetric
          label="Execution impact"
          value={percent(
            scenario.executionImpactPercent
          )}
        />

        <QuoteMetric
          label="Trading fee"
          value={money(
            scenario.tradingFeeUsd,
            4
          )}
          detail={`${money(
            scenario.protocolFeeUsd,
            4
          )} protocol`}
        />
      </div>

      <div
        className={`mt-8 rounded-2xl border p-5 ${guardStyles[guard.zone]}`}
      >
        <div className="flex items-start gap-3">
          {guard.zone ===
          "fairValue" ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          ) : guard.zone ===
            "outside" ? (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <Activity className="mt-0.5 h-5 w-5 shrink-0" />
          )}

          <div>
            <p className="font-medium">
              {guard.label}
            </p>

            <p className="mt-2 text-sm leading-6 opacity-80">
              {
                guard.message
              }
            </p>

            <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
              <div>
                Before trade:{" "}
                {percent(
                  scenario.referencePremiumBeforePercent
                )}
              </div>

              <div>
                After trade:{" "}
                {percent(
                  scenario.referencePremiumAfterPercent
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-white/[0.06] bg-black/20 p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />

          <p className="text-sm font-medium">
            Execution diagnostics
          </p>
        </div>

        <div className="mt-4 space-y-3 text-sm">
          <Row
            label="Requested input"
            value={money(
              scenario.inputUsd
            )}
          />

          <Row
            label="Consumed input"
            value={money(
              scenario.consumedUsd
            )}
          />

          <Row
            label="Amount left"
            value={money(
              scenario.amountLeftUsd
            )}
          />

          <Row
            label="Referral fee"
            value={money(
              scenario.referralFeeUsd,
              4
            )}
          />
        </div>
      </div>

      <DeployMarketButton
        ticker={
          snapshot.ticker
        }
        referencePrice={
          snapshot.referencePrice
        }
        annualizedVolatility={
          snapshot.annualizedVolatility
        }
        targetRaiseUsd={
          snapshot.targetRaiseUsd
        }
        graduationUsd={
          snapshot.graduationUsd
        }
        totalSupply={
          snapshot.totalSupply
        }
        riskProfile={
          snapshot.riskProfile
        }
      />
    </>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0d1014] p-5">
      <div className="flex items-center gap-2 text-xs text-zinc-600">
        <Icon className="h-4 w-4" />

        {label}
      </div>

      <p className="mt-4 text-2xl font-semibold tracking-tight">
        {value}
      </p>

      <p className="mt-2 text-xs text-zinc-600">
        {detail}
      </p>
    </div>
  );
}

function QuoteMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
      <p className="text-xs text-zinc-600">
        {label}
      </p>

      <p className="mt-2 text-lg font-medium">
        {value}
      </p>

      {detail && (
        <p className="mt-1 text-xs text-zinc-700">
          {detail}
        </p>
      )}
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-6">
      <span className="text-zinc-600">
        {label}
      </span>

      <span className="text-right text-zinc-300">
        {value}
      </span>
    </div>
  );
}