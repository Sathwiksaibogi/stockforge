"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  Activity,
  ArrowRight,
  BarChart3,
  CircleDollarSign,
  Gauge,
  Radio,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

import { Navbar } from "@/components/navbar";


import {
  useRouter,
} from "next/navigation";

import {
  usePythPrice,
} from "@/hooks/use-pyth-price";

import {
  useMarketHistory,
} from "@/hooks/use-market-history";

import {
  compileStockForgeCurve,
} from "@/lib/curve-engine/compiler";

import type {
  RiskProfile,
} from "@/lib/curve-engine/types";

function formatMoney(
  value: number
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }
  ).format(value);
}

function formatPercent(
  value: number
) {
  return `${value.toFixed(2)}%`;
}

const profiles: {
  id: RiskProfile;
  title: string;
  description: string;
}[] = [
  {
    id: "conservative",
    title: "Conservative",
    description:
      "Deep liquidity around reference value.",
  },

  {
    id: "balanced",
    title: "Balanced",
    description:
      "Controlled discovery with meaningful upside range.",
  },

  {
    id: "aggressive",
    title: "Aggressive",
    description:
      "Wider discovery and expansion regions.",
  },
];

export default function CreateMarketPage() {

  const router =
    useRouter();

  const {
    data: price,
    loading: priceLoading,
    error: priceError,
  } = usePythPrice("TSLA");

  const {
    data: history,
    loading: historyLoading,
    error: historyError,
  } = useMarketHistory(
    "TSLA",
    30
  );

  const [
    targetRaise,
    setTargetRaise,
  ] = useState(50_000);

  const [
    graduationThreshold,
    setGraduationThreshold,
  ] = useState(40_000);

  const [
    riskProfile,
    setRiskProfile,
  ] =
    useState<RiskProfile>(
      "balanced"
    );

  const compiled =
    useMemo(() => {
      if (
        !price ||
        !history
      ) {
        return {
          curve: null,
          error: null,
        };
      }

      try {
        const curve =
          compileStockForgeCurve({
            referencePrice:
              price.price,

            annualizedVolatility:
              history.volatility
                .annualizedVolatility,

            targetRaiseUsd:
              targetRaise,

            graduationThresholdUsd:
              graduationThreshold,

            riskProfile,
          });

        return {
          curve,
          error: null,
        };
      } catch (error) {
        return {
          curve: null,

          error:
            error instanceof Error
              ? error.message
              : "Curve compilation failed.",
        };
      }
    }, [
      price,
      history,
      targetRaise,
      graduationThreshold,
      riskProfile,
    ]);

  const curve =
    compiled.curve;

  const loading =
    priceLoading ||
    historyLoading;

  const marketError =
    priceError ||
    historyError;


    function continueToSimulation() {
  if (
    !price ||
    !history ||
    !curve
  ) {
    return;
  }

  /*
   * Freeze the exact financial-market
   * snapshot used to compile this curve.
   *
   * Pyth may continue moving afterward,
   * but this proposed DBC remains
   * deterministic.
   */
  const params =
    new URLSearchParams({
      ticker:
        "TSLA",

      reference:
        price.price.toString(),

      volatility:
        history.volatility
          .annualizedVolatility
          .toString(),

      regime:
        history.volatility
          .regime,

      session:
        price.marketSession ??
        "unknown",

      targetRaise:
        targetRaise.toString(),

      graduation:
        graduationThreshold.toString(),

      supply:
        "1000",

      risk:
        riskProfile,

      snapshot:
        Date.now().toString(),
    });

  router.push(
    `/simulate?${params.toString()}`
  );
}

  return (
    <main className="min-h-screen bg-[#07090c] text-white">
      <Navbar />

      <div className="mx-auto max-w-7xl px-6 pb-24 pt-36 lg:px-8">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.18em] text-emerald-400">
            <Activity className="h-4 w-4" />
            StockForge Curve Compiler
          </div>

          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
            Design a market around
            real financial data.
          </h1>

          <p className="mt-5 max-w-2xl leading-7 text-zinc-400">
            StockForge converts Pyth
            reference prices and realized
            volatility into a deterministic
            tokenized-equity launch profile.
          </p>
        </div>

        {loading && (
          <div className="mt-12 rounded-2xl border border-white/[0.07] bg-[#0d1014] p-8 text-sm text-zinc-500">
            Loading Pyth market
            intelligence...
          </div>
        )}

        {marketError && (
          <div className="mt-12 rounded-2xl border border-red-400/20 bg-red-400/[0.06] p-6 text-sm text-red-300">
            {marketError}
          </div>
        )}

        {!loading &&
          price &&
          history && (
            <>
              <section className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  icon={Radio}
                  title="Reference price"
                  value={formatMoney(
                    price.price
                  )}
                  subtitle="Pyth Pro · TSLA"
                />

                <MetricCard
                  icon={TrendingUp}
                  title="30D volatility"
                  value={formatPercent(
                    history.volatility
                      .annualizedVolatilityPercent
                  )}
                  subtitle="Annualized realized"
                />

                <MetricCard
                  icon={Gauge}
                  title="Volatility regime"
                  value={
                    history.volatility.regime
                      .charAt(0)
                      .toUpperCase() +
                    history.volatility.regime.slice(
                      1
                    )
                  }
                  subtitle={`${history.volatility.observations} returns`}
                />

                <MetricCard
                  icon={BarChart3}
                  title="Market session"
                  value={
                    price.marketSession ??
                    "Unknown"
                  }
                  subtitle="Pyth feed status"
                />
              </section>

              <div className="mt-8 grid gap-8 xl:grid-cols-[0.82fr_1.18fr]">
                <section className="rounded-[26px] border border-white/[0.07] bg-[#0d1014] p-6">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-zinc-600">
                      Issuer parameters
                    </p>

                    <h2 className="mt-3 text-xl font-medium">
                      Market configuration
                    </h2>
                  </div>

                  <div className="mt-8 space-y-7">
                    <div>
                      <label className="text-sm text-zinc-400">
                        Reference asset
                      </label>

                      <div className="mt-3 flex items-center justify-between rounded-xl border border-white/[0.07] bg-black/20 px-4 py-4">
                        <div>
                          <p className="font-medium">
                            TSLA
                          </p>

                          <p className="mt-1 text-xs text-zinc-600">
                            Tesla, Inc.
                          </p>
                        </div>

                        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-300">
                          PYTH LIVE
                        </span>
                      </div>
                    </div>

                    <NumberField
                      label="Planning raise target"
                      value={
                        targetRaise
                      }
                      onChange={
                        setTargetRaise
                      }
                    />

                    <NumberField
                      label="Desired graduation target"
                      value={
                        graduationThreshold
                      }
                      onChange={
                        setGraduationThreshold
                      }
                    />

                    <div>
                      <label className="text-sm text-zinc-400">
                        Market profile
                      </label>

                      <div className="mt-3 space-y-3">
                        {profiles.map(
                          (profile) => {
                            const selected =
                              riskProfile ===
                              profile.id;

                            return (
                              <button
                                key={
                                  profile.id
                                }
                                type="button"
                                onClick={() =>
                                  setRiskProfile(
                                    profile.id
                                  )
                                }
                                className={`w-full rounded-xl border p-4 text-left transition ${
                                  selected
                                    ? "border-emerald-400/30 bg-emerald-400/[0.07]"
                                    : "border-white/[0.07] bg-black/20 hover:bg-white/[0.03]"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div>
                                    <p className="text-sm font-medium text-zinc-200">
                                      {
                                        profile.title
                                      }
                                    </p>

                                    <p className="mt-1 text-xs leading-5 text-zinc-600">
                                      {
                                        profile.description
                                      }
                                    </p>
                                  </div>

                                  <span
                                    className={`mt-1 h-3 w-3 rounded-full border ${
                                      selected
                                        ? "border-emerald-300 bg-emerald-400"
                                        : "border-zinc-600"
                                    }`}
                                  />
                                </div>
                              </button>
                            );
                          }
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-[26px] border border-white/[0.07] bg-[#0d1014] p-6 sm:p-8">
                  <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-emerald-400">
                        Compiled market
                      </p>

                      <h2 className="mt-3 text-2xl font-medium">
                        StockForge market
                        design
                      </h2>
                    </div>

                    {curve && (
                      <div className="rounded-lg border border-white/[0.07] bg-black/20 px-3 py-2 font-mono text-xs text-zinc-500">
                        {curve.version}
                      </div>
                    )}
                  </div>

                  {compiled.error && (
                    <div className="mt-8 rounded-xl border border-red-400/20 bg-red-400/[0.06] p-4 text-sm text-red-300">
                      {compiled.error}
                    </div>
                  )}

                  {curve && (
                    <>
                      <div className="mt-8 grid gap-3 sm:grid-cols-2">
                        <CompiledMetric
                          title="Reference"
                          value={formatMoney(
                            curve.referencePrice
                          )}
                        />

                        <CompiledMetric
                          title="Initial price"
                          value={formatMoney(
                            curve.initialPrice
                          )}
                          subtitle={`${curve.metrics.initialDiscountPercent}% below reference`}
                        />

                        <CompiledMetric
                          title="Trading fee"
                          value={`${curve.feeBps} bps`}
                          subtitle="Volatility adjusted"
                        />

                        <CompiledMetric
                          title="Graduation"
                          value={formatMoney(
                            curve.migrationQuoteThresholdUsd
                          )}
                          subtitle="Quote-side threshold"
                        />
                      </div>

                      <div className="mt-8">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-zinc-200">
                              Liquidity
                              distribution
                            </p>

                            <p className="mt-1 text-xs text-zinc-600">
                            Relative Meteora liquidity weighting
                            across price regions
                            </p>
                          </div>

                          <ShieldCheck className="h-5 w-5 text-emerald-400" />
                        </div>

                        <div className="mt-5 flex h-4 overflow-hidden rounded-full bg-black">
                          <div
                            className="bg-amber-400/70"
                            style={{
                              width: `${
                                curve
                                  .bands
                                  .discovery
                                  .allocationWeight *
                                100
                              }%`,
                            }}
                          />

                          <div
                            className="bg-emerald-400"
                            style={{
                              width: `${
                                curve
                                  .bands
                                  .fairValue
                                  .allocationWeight *
                                100
                              }%`,
                            }}
                          />

                          <div
                            className="bg-blue-400/80"
                            style={{
                              width: `${
                                curve
                                  .bands
                                  .expansion
                                  .allocationWeight *
                                100
                              }%`,
                            }}
                          />
                        </div>

                        <div className="mt-6 space-y-3">
                          <BandRow
                            name="Discovery"
                            band={
                              curve.bands
                                .discovery
                            }
                            dotClass="bg-amber-400"
                          />

                          <BandRow
                            name="Fair value"
                            band={
                              curve.bands
                                .fairValue
                            }
                            dotClass="bg-emerald-400"
                          />

                          <BandRow
                            name="Expansion"
                            band={
                              curve.bands
                                .expansion
                            }
                            dotClass="bg-blue-400"
                          />
                        </div>
                      </div>

                      <div className="mt-8 rounded-2xl border border-white/[0.06] bg-black/20 p-5">
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-emerald-400" />

                          <p className="text-sm font-medium">
                            Why this curve?
                          </p>
                        </div>

                        <div className="mt-4 space-y-3">
                          {curve.reasoning.map(
                            (
                              reason,
                              index
                            ) => (
                              <div
                                key={
                                  reason
                                }
                                className="flex gap-3 text-sm leading-6 text-zinc-500"
                              >
                                <span className="font-mono text-xs text-zinc-700">
                                  0
                                  {index +
                                    1}
                                </span>

                                <span>
                                  {
                                    reason
                                  }
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      </div>

                      <button
                            type="button"
                            onClick={
                                continueToSimulation
                            }
                            disabled={!curve}
                            className="mt-8 flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 font-semibold text-[#04110c] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
                            >
                            Continue to simulation

                            <ArrowRight className="h-4 w-4" />
                        </button>

                      <p className="mt-3 text-center text-[11px] text-zinc-700">
                        StockForge target
                        profile — Meteora DBC
                        compilation comes next.
                      </p>
                    </>
                  )}
                </section>
              </div>
            </>
          )}
      </div>
    </main>
  );
}

function MetricCard({
  icon: Icon,
  title,
  value,
  subtitle,
}: {
  icon: React.ElementType;
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0d1014] p-5">
      <div className="flex items-center gap-2 text-xs text-zinc-600">
        <Icon className="h-4 w-4" />

        {title}
      </div>

      <p className="mt-4 text-2xl font-semibold tracking-tight">
        {value}
      </p>

      <p className="mt-2 text-xs text-zinc-600">
        {subtitle}
      </p>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (
    value: number
  ) => void;
}) {
  return (
    <div>
      <label className="text-sm text-zinc-400">
        {label}
      </label>

      <div className="mt-3 flex items-center rounded-xl border border-white/[0.07] bg-black/20 px-4">
        <CircleDollarSign className="h-4 w-4 text-zinc-600" />

        <input
          type="number"
          min="1"
          value={value}
          onChange={(event) =>
            onChange(
              Number(
                event.target.value
              )
            )
          }
          className="h-12 w-full bg-transparent px-3 text-sm outline-none"
        />
      </div>
    </div>
  );
}

function CompiledMetric({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
      <p className="text-xs text-zinc-600">
        {title}
      </p>

      <p className="mt-2 text-lg font-medium text-zinc-200">
        {value}
      </p>

      {subtitle && (
        <p className="mt-1 text-xs text-zinc-700">
          {subtitle}
        </p>
      )}
    </div>
  );
}

function BandRow({
  name,
  band,
  dotClass,
}: {
  name: string;

  band: {
    lowerPrice: number;
    upperPrice: number;
    allocationWeight: number;
    allocationUsd: number;
  };

  dotClass: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-xl border border-white/[0.05] bg-white/[0.02] p-4">
      <div>
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${dotClass}`}
          />

          <p className="text-sm font-medium text-zinc-300">
            {name}
          </p>
        </div>

        <p className="mt-2 font-mono text-xs text-zinc-600">
          {formatMoney(
            band.lowerPrice
          )}{" "}
          →{" "}
          {formatMoney(
            band.upperPrice
          )}
        </p>
      </div>

      <div className="text-right">
        <p className="text-sm font-medium">
          {(
            band.allocationWeight *
            100
          ).toFixed(0)}
          %
        </p>

        <p className="mt-1 text-xs text-zinc-600">
            relative weight
        </p>
      </div>
    </div>
  );
}