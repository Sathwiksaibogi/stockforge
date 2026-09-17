"use client";

import {
  Activity,
  Clock3,
  Database,
  RefreshCw,
  Radio,
} from "lucide-react";

import { usePythPrice } from "@/hooks/use-pyth-price";

function formatCurrency(
  value: number,
  digits = 2
) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatSession(
  session: string | null
) {
  if (!session) {
    return "Unknown";
  }

  const sessions: Record<string, string> = {
    regular: "Regular",
    preMarket: "Pre-market",
    postMarket: "Post-market",
    overNight: "Overnight",
    closed: "Closed",
  };

  return sessions[session] ?? session;
}

function formatTimestamp(
  timestampUs: number | null
) {
  if (!timestampUs) {
    return "Unavailable";
  }

  const milliseconds = Math.floor(
    timestampUs / 1000
  );

  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(milliseconds));
}

export function LiveReferenceCard() {
  const {
    data,
    loading,
    error,
    refresh,
  } = usePythPrice("TSLA");

  return (
    <div className="relative">
      <div className="absolute -inset-12 rounded-full bg-emerald-400/[0.04] blur-3xl" />

      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#0d1014]/90 shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-zinc-600">
              Pyth reference market
            </p>

            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 text-sm font-semibold text-red-300">
                T
              </div>

              <div>
                <p className="font-medium">
                  TSLA
                </p>

                <p className="text-xs text-zinc-500">
                  Tesla, Inc.
                </p>
              </div>
            </div>
          </div>

          {data && (
            <div
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
                data.isStale
                  ? "border-amber-400/20 bg-amber-400/10 text-amber-300"
                  : "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  data.isStale
                    ? "bg-amber-300"
                    : "animate-pulse bg-emerald-300"
                }`}
              />

              {data.isStale
                ? "STALE"
                : "PYTH LIVE"}
            </div>
          )}
        </div>

        <div className="p-6">
          {loading && !data && (
            <div className="flex h-[340px] items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-zinc-500">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Loading Pyth market data...
              </div>
            </div>
          )}

          {error && !data && (
            <div className="flex h-[340px] flex-col items-center justify-center text-center">
              <p className="text-sm text-red-300">
                Market data unavailable
              </p>

              <p className="mt-2 max-w-xs text-xs leading-5 text-zinc-600">
                {error}
              </p>

              <button
                onClick={() => void refresh()}
                className="mt-5 rounded-lg border border-white/10 px-4 py-2 text-xs text-zinc-300 transition hover:bg-white/[0.05]"
              >
                Retry
              </button>
            </div>
          )}

          {data && (
            <>
              <div className="flex items-end justify-between gap-6">
                <div>
                  <p className="text-sm text-zinc-500">
                    Reference price
                  </p>

                  <p className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
                    {formatCurrency(data.price)}
                  </p>

                  <p className="mt-2 font-mono text-xs text-zinc-600">
                    {data.price.toFixed(5)}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.16em] text-zinc-600">
                    Session
                  </p>

                  <p className="mt-2 text-sm font-medium text-blue-300">
                    {formatSession(
                      data.marketSession
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-8 rounded-2xl border border-white/[0.06] bg-black/20 p-5">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-zinc-600">
                  <Radio className="h-3.5 w-3.5 text-emerald-400" />
                  Live feed diagnostics
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-4">
                    <div className="flex items-center gap-2 text-xs text-zinc-600">
                      <Activity className="h-3.5 w-3.5" />
                      Confidence
                    </div>

                    <p className="mt-2 text-sm font-medium text-zinc-200">
                      {data.confidence !== null
                        ? `±${formatCurrency(
                            data.confidence,
                            5
                          )}`
                        : "—"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-4">
                    <div className="flex items-center gap-2 text-xs text-zinc-600">
                      <Database className="h-3.5 w-3.5" />
                      Publishers
                    </div>

                    <p className="mt-2 text-sm font-medium text-zinc-200">
                      {data.publisherCount ?? "—"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-4">
                    <div className="flex items-center gap-2 text-xs text-zinc-600">
                      <Clock3 className="h-3.5 w-3.5" />
                      Feed update
                    </div>

                    <p className="mt-2 text-sm font-medium text-zinc-200">
                      {formatTimestamp(
                        data.feedUpdateTimestamp
                      )}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/[0.05] bg-white/[0.025] p-4">
                    <div className="flex items-center gap-2 text-xs text-zinc-600">
                      <Radio className="h-3.5 w-3.5" />
                      Source
                    </div>

                    <p className="mt-2 text-sm font-medium text-emerald-300">
                      Pyth Pro
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-white/[0.06] pt-5">
                <div>
                  <p className="text-xs text-zinc-600">
                    Feed
                  </p>

                  <p className="mt-1 font-mono text-xs text-zinc-400">
                    Equity.US.TSLA/USD
                  </p>
                </div>

                <button
                  onClick={() =>
                    void refresh()
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] text-zinc-500 transition hover:bg-white/[0.05] hover:text-white"
                  aria-label="Refresh market data"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}