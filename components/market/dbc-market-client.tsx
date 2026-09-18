"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useConnection,
  useWallet,
} from "@solana/wallet-adapter-react";

import {
  useWalletModal,
} from "@solana/wallet-adapter-react-ui";

import Decimal from "decimal.js";

import {
  executeStockForgeBuy,
  getStockForgeBuyQuote,
  STOCKFORGE_DEMO_POOL,
  type StockForgeBuyQuote,
} from "@/lib/meteora/trade-stockforge";

type PoolResponse = {
  network: string;

  addresses: {
    pool: string;
    config: string;
    baseMint: string;
    quoteMint: string;
  };

  market: {
    baseReserveRaw: string;
    quoteReserveRaw: string;
    sqrtPrice: string;
    migrationProgress: number;
    isMigrated: number;
    hasSwap: number;
  };

  configSummary: {
    tokenDecimals: number;
    baseFeeNumerator: string;
    migrationQuoteThresholdRaw: string;
  };
};

function formatRaw(
  raw: string,
  decimals = 6
) {
  return new Decimal(raw)
    .div(
      new Decimal(10).pow(
        decimals
      )
    )
    .toDecimalPlaces(6)
    .toString();
}

function truncateAddress(
  value: string
) {
  return `${value.slice(
    0,
    6
  )}...${value.slice(-6)}`;
}

export function DbcMarketClient() {
  const {
    connection,
  } = useConnection();

  const {
    connected,
    publicKey,
    signTransaction,
  } = useWallet();

  const {
    setVisible,
  } = useWalletModal();

  const [
    amount,
    setAmount,
  ] =
    useState("10");

  const [
    pool,
    setPool,
  ] =
    useState<PoolResponse | null>(
      null
    );

  const [
    quote,
    setQuote,
  ] =
    useState<StockForgeBuyQuote | null>(
      null
    );

  const [
    loadingPool,
    setLoadingPool,
  ] =
    useState(true);

  const [
    quoting,
    setQuoting,
  ] =
    useState(false);

  const [
    swapping,
    setSwapping,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );

  const [
    signature,
    setSignature,
  ] =
    useState<string | null>(
      null
    );

  const refreshPool =
    useCallback(
      async () => {
        setLoadingPool(true);

        try {
          const response =
            await fetch(
              `/api/meteora/pool?pool=${STOCKFORGE_DEMO_POOL.toBase58()}`,
              {
                cache:
                  "no-store",
              }
            );

          const data =
            await response.json();

          if (!response.ok) {
            throw new Error(
              data.error ??
                "Unable to load pool."
            );
          }

          setPool(
            data as PoolResponse
          );

          setError(null);
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load pool."
          );
        } finally {
          setLoadingPool(false);
        }
      },
      []
    );

  useEffect(() => {
    let cancelled = false;

    async function loadInitialPool() {
      try {
        const response =
          await fetch(
            `/api/meteora/pool?pool=${STOCKFORGE_DEMO_POOL.toBase58()}`,
            {
              cache:
                "no-store",
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ??
              "Unable to load pool."
          );
        }

        if (!cancelled) {
          setPool(
            data as PoolResponse
          );

          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load pool."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingPool(false);
        }
      }
    }

    void loadInitialPool();

    return () => {
      cancelled = true;
    };
  }, []);

  const migrationPercent =
    useMemo(() => {
      if (!pool) {
        return "0.00";
      }

      const reserve =
        new Decimal(
          pool.market
            .quoteReserveRaw
        );

      const target =
        new Decimal(
          pool.configSummary
            .migrationQuoteThresholdRaw
        );

      if (target.lte(0)) {
        return "0.00";
      }

      return Decimal.min(
        reserve
          .div(target)
          .mul(100),
        100
      )
        .toDecimalPlaces(2)
        .toString();
    }, [pool]);

  async function handleQuote() {
    setError(null);
    setSignature(null);
    setQuoting(true);

    try {
      const result =
        await getStockForgeBuyQuote({
          connection,

          amountUsdc:
            amount,

          slippageBps:
            100,
        });

      setQuote(result);
    } catch (err) {
      setQuote(null);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to quote trade."
      );
    } finally {
      setQuoting(false);
    }
  }

  async function handleSwap() {
    if (
      !connected ||
      !publicKey ||
      !signTransaction
    ) {
      setError(
        "Connect Phantom before trading."
      );

      return;
    }

    setError(null);
    setSignature(null);
    setSwapping(true);

    try {
      const result =
        await executeStockForgeBuy({
          connection,

          walletPublicKey:
            publicKey,

          signTransaction,

          amountUsdc:
            amount,

          slippageBps:
            100,
        });

      setQuote(
        result.quote
      );

      setSignature(
        result.signature
      );

      await refreshPool();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Swap failed."
      );
    } finally {
      setSwapping(false);
    }
  }

  function handleTradeButton() {
    if (!connected) {
      setVisible(true);
      return;
    }

    void handleSwap();
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="mb-10">
        <div className="mb-3 flex items-center gap-3">
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            DEVNET · LIVE DBC
          </span>

          {pool?.market.hasSwap ===
          0 ? (
            <span className="text-xs text-zinc-500">
              No trades yet
            </span>
          ) : (
            <span className="text-xs text-emerald-400">
              Trading active
            </span>
          )}
        </div>

        <h1 className="text-4xl font-semibold tracking-tight text-white">
          TSLA-SF Market
        </h1>

        <p className="mt-3 max-w-3xl text-zinc-400">
          Real StockForge Meteora
          Dynamic Bonding Curve on
          Solana devnet.
        </p>
      </div>

      {loadingPool &&
      !pool ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-zinc-400">
          Loading on-chain
          pool...
        </div>
      ) : null}

      {pool ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Metric
              label="TSLA-SF reserve"
              value={`${formatRaw(
                pool.market
                  .baseReserveRaw
              )} TSLA-SF`}
            />

            <Metric
              label="USDC reserve"
              value={`${formatRaw(
                pool.market
                  .quoteReserveRaw
              )} USDC`}
            />

            <Metric
              label="Graduation"
              value={`${migrationPercent}%`}
            />

            <Metric
              label="Status"
              value={
                pool.market
                  .isMigrated ===
                0
                  ? "Bonding curve"
                  : "Migrated"
              }
            />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white">
                  Buy TSLA-SF
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  USDC → TSLA-SF
                  through the real
                  deployed Meteora
                  curve.
                </p>
              </div>

              <label className="mb-2 block text-sm text-zinc-400">
                You pay
              </label>

              <div className="flex items-center rounded-xl border border-white/10 bg-black/30 px-4">
                <input
                  value={amount}
                  onChange={(
                    event
                  ) => {
                    setAmount(
                      event
                        .target
                        .value
                    );

                    setQuote(null);
                    setSignature(null);
                    setError(null);
                  }}
                  className="w-full bg-transparent py-4 text-xl text-white outline-none"
                  inputMode="decimal"
                  placeholder="0.00"
                />

                <span className="font-medium text-zinc-300">
                  USDC
                </span>
              </div>

              <button
                onClick={
                  handleQuote
                }
                disabled={
                  quoting ||
                  swapping
                }
                className="mt-4 w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 font-medium text-white transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {quoting
                  ? "Getting real quote..."
                  : "Get Meteora quote"}
              </button>

              {quote ? (
                <div className="mt-5 space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
                  <QuoteRow
                    label="Expected output"
                    value={`${quote.outputAmountUi} TSLA-SF`}
                  />

                  <QuoteRow
                    label="Minimum received"
                    value={`${quote.minimumAmountOutUi} TSLA-SF`}
                  />

                  <QuoteRow
                    label="Slippage protection"
                    value={`${quote.slippageBps / 100}%`}
                  />

                  <QuoteRow
                    label="Trading fee"
                    value={`${formatRaw(
                      quote.tradingFeeRaw
                    )} USDC`}
                  />
                </div>
              ) : null}

              <button
                onClick={
                  handleTradeButton
                }
                disabled={
                  swapping ||
                  (
                    connected &&
                    !quote
                  )
                }
                className="mt-5 w-full rounded-xl bg-white px-4 py-3 font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {swapping
                  ? "Waiting for Phantom..."
                  : connected
                    ? quote
                      ? "Buy TSLA-SF"
                      : "Get quote first"
                    : "Connect wallet to trade"}
              </button>

              {connected &&
              publicKey ? (
                <div className="mt-3 text-center text-xs text-zinc-500">
                  Connected:
                  {" "}
                  {truncateAddress(
                    publicKey.toBase58()
                  )}
                </div>
              ) : null}

              {error ? (
                <pre className="mt-5 overflow-x-auto whitespace-pre-wrap rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-300">
                  {error}
                </pre>
              ) : null}

              {signature ? (
                <div className="mt-5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                  <p className="font-medium text-emerald-300">
                    Swap confirmed
                    on devnet.
                  </p>

                  <a
                    href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block break-all text-xs text-emerald-400 underline"
                  >
                    {signature}
                  </a>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-xl font-semibold text-white">
                On-chain market
              </h2>

              <div className="mt-6 space-y-4">
                <AddressRow
                  label="DBC pool"
                  value={
                    pool.addresses
                      .pool
                  }
                />

                <AddressRow
                  label="Config"
                  value={
                    pool.addresses
                      .config
                  }
                />

                <AddressRow
                  label="TSLA-SF mint"
                  value={
                    pool.addresses
                      .baseMint
                  }
                />

                <AddressRow
                  label="USDC mint"
                  value={
                    pool.addresses
                      .quoteMint
                  }
                />

                <QuoteRow
                  label="Graduation target"
                  value={`${formatRaw(
                    pool.configSummary
                      .migrationQuoteThresholdRaw
                  )} USDC`}
                />

                <QuoteRow
                  label="Has traded"
                  value={
                    pool.market
                      .hasSwap ===
                    1
                      ? "Yes"
                      : "No"
                  }
                />
              </div>

              <button
                onClick={() =>
                  void refreshPool()
                }
                disabled={
                  loadingPool
                }
                className="mt-6 w-full rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loadingPool
                  ? "Refreshing..."
                  : "Refresh on-chain state"}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </p>

      <p className="mt-2 text-lg font-semibold text-white">
        {value}
      </p>
    </div>
  );
}

function QuoteRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-zinc-500">
        {label}
      </span>

      <span className="text-right text-zinc-200">
        {value}
      </span>
    </div>
  );
}

function AddressRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-zinc-500">
        {label}
      </span>

      <a
        href={`https://explorer.solana.com/address/${value}?cluster=devnet`}
        target="_blank"
        rel="noreferrer"
        title={value}
        className="font-mono text-sm text-zinc-200 underline decoration-zinc-700 underline-offset-4"
      >
        {truncateAddress(
          value
        )}
      </a>
    </div>
  );
}