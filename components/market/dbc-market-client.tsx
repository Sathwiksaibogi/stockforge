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

import {
  PublicKey,
  type Connection,
} from "@solana/web3.js";

import Decimal from "decimal.js";

import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CircleDollarSign,
  Radio,
} from "lucide-react";

import {
  executeStockForgeBuy,
  getStockForgeBuyQuote,
  type StockForgeBuyQuote,
} from "@/lib/meteora/trade-stockforge";

import {
  getStockForgeMarketOptions,
  type StockForgeMarketOption,
} from "@/lib/stockforge/market-registry";

import type {
  PythEquityTicker,
} from "@/lib/pyth/feeds";

import {
  usePythPrice,
} from "@/hooks/use-pyth-price";

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

  raw: {
    config: {
      sqrtStartPrice: string;
      migrationSqrtPrice: string;

      curve: Array<{
        sqrtPrice: string;
        liquidity: string;
      }>;
    };
  };
};

type MarketIntelligence = {
  dbcPrice: number;

  referencePrice:
    | number
    | null;

  premiumPercent:
    | number
    | null;

  differenceUsd:
    | number
    | null;

  relationship:
    | "below"
    | "near"
    | "above"
    | "unknown";
};

type StockForgeZone =
  | "discovery"
  | "fairValue"
  | "expansion"
  | "outside";

type CurveZones = {
  start: number;
  discoveryEnd: number;
  fairValueEnd: number;
  expansionEnd: number;
  current: number;
  zone: StockForgeZone;

  discoveryWidthPercent: number;
  fairValueWidthPercent: number;
  expansionWidthPercent: number;
  currentPositionPercent: number;
};

type WalletTokenBalances = {
  owner: string;
  usdc: number;
  assetToken: number;
};

type TradePreview = {
  inputUsdc: number;
  outputTokens: number;
  currentDbcPrice: number;
  postTradeDbcPrice: number;
  priceImpactPercent: number;
  currentZone: StockForgeZone;
  postTradeZone: StockForgeZone;
  allInExecutionPrice: number;
  allInPremiumVsSpot: number;
  estimatedUsdcAfter: number | null;
  estimatedAssetAfter: number | null;
};

const Q64 =
  new Decimal(2).pow(64);

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

function formatUsd(
  value: number
) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",

      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  ).format(value);
}

function formatTokenAmount(
  value: number,
  maximumFractionDigits = 6
) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat(
    "en-US",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits,
    }
  ).format(value);
}

function formatSignedPercent(
  value: number
) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  const sign =
    value > 0
      ? "+"
      : "";

  return `${sign}${value.toFixed(
    2
  )}%`;
}

function truncateAddress(
  value: string
) {
  return `${value.slice(
    0,
    6
  )}...${value.slice(-6)}`;
}

function deriveDbcPrice(
  sqrtPriceRaw: string
) {
  /*
   * Meteora DBC stores sqrt(price)
   * in Q64.64 fixed-point format.
   *
   * StockForge base tokens and Devnet USDC both
   * use 6 decimals, so no decimal
   * adjustment is required here.
   *
   * price =
   * (sqrtPrice / 2^64)^2
   */
  const sqrtPrice =
    new Decimal(
      sqrtPriceRaw
    ).div(Q64);

  return sqrtPrice
    .mul(sqrtPrice)
    .toNumber();
}

async function getMintBalance({
  connection,
  owner,
  mint,
}: {
  connection: Connection;
  owner: PublicKey;
  mint: string;
}) {
  const response =
    await connection.getParsedTokenAccountsByOwner(
      owner,
      {
        mint: new PublicKey(mint),
      },
      "confirmed"
    );

  return response.value.reduce(
    (total, account) => {
      const parsed =
        account.account.data;

      if (!("parsed" in parsed)) {
        return total;
      }

      const amountString =
        parsed.parsed?.info
          ?.tokenAmount
          ?.uiAmountString;

      const amount =
        Number(amountString ?? 0);

      return Number.isFinite(amount)
        ? total + amount
        : total;
    },
    0
  );
}

function classifyPriceZone(
  price: number,
  zones: Pick<
    CurveZones,
    | "start"
    | "discoveryEnd"
    | "fairValueEnd"
    | "expansionEnd"
  >
): StockForgeZone {
  if (
    price >= zones.start &&
    price < zones.discoveryEnd
  ) {
    return "discovery";
  }

  if (
    price >= zones.discoveryEnd &&
    price < zones.fairValueEnd
  ) {
    return "fairValue";
  }

  if (
    price >= zones.fairValueEnd &&
    price <= zones.expansionEnd
  ) {
    return "expansion";
  }

  return "outside";
}

function deriveCurveZones(
  pool: PoolResponse
): CurveZones | null {
  const activeCurvePoints =
    pool.raw.config.curve.filter(
      (point) =>
        point.sqrtPrice !== "0"
    );

  if (
    activeCurvePoints.length <
    3
  ) {
    return null;
  }

  const start =
    deriveDbcPrice(
      pool.raw.config
        .sqrtStartPrice
    );

  const discoveryEnd =
    deriveDbcPrice(
      activeCurvePoints[0]
        .sqrtPrice
    );

  const fairValueEnd =
    deriveDbcPrice(
      activeCurvePoints[1]
        .sqrtPrice
    );

  const expansionEnd =
    deriveDbcPrice(
      activeCurvePoints[2]
        .sqrtPrice
    );

  const current =
    deriveDbcPrice(
      pool.market.sqrtPrice
    );

  if (
    ![
      start,
      discoveryEnd,
      fairValueEnd,
      expansionEnd,
      current,
    ].every(Number.isFinite) ||
    !(
      start <
        discoveryEnd &&
      discoveryEnd <
        fairValueEnd &&
      fairValueEnd <=
        expansionEnd
    )
  ) {
    return null;
  }

  const zone =
    classifyPriceZone(
      current,
      {
        start,
        discoveryEnd,
        fairValueEnd,
        expansionEnd,
      }
    );

  const totalRange =
    expansionEnd - start;

  const discoveryWidthPercent =
    (
      (
        discoveryEnd -
        start
      ) /
      totalRange
    ) *
    100;

  const fairValueWidthPercent =
    (
      (
        fairValueEnd -
        discoveryEnd
      ) /
      totalRange
    ) *
    100;

  const expansionWidthPercent =
    Math.max(
      0,
      100 -
        discoveryWidthPercent -
        fairValueWidthPercent
    );

  const currentPositionPercent =
    Math.min(
      100,
      Math.max(
        0,
        (
          (
            current -
            start
          ) /
          totalRange
        ) *
          100
      )
    );

  return {
    start,
    discoveryEnd,
    fairValueEnd,
    expansionEnd,
    current,
    zone,

    discoveryWidthPercent,
    fairValueWidthPercent,
    expansionWidthPercent,
    currentPositionPercent,
  };
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
    marketOptions,
    setMarketOptions,
  ] =
    useState<
      StockForgeMarketOption[]
    >(() =>
      getStockForgeMarketOptions()
    );

  const [
    selectedTicker,
    setSelectedTicker,
  ] =
    useState<PythEquityTicker>(
      "TSLA"
    );

  /*
   * Re-read browser deployments after
   * hydration so newly deployed markets
   * stored in localStorage are available.
   */
  useEffect(() => {
    const refreshRegistry =
      window.setTimeout(() => {
        setMarketOptions(
          getStockForgeMarketOptions()
        );
      }, 0);

    return () => {
      window.clearTimeout(
        refreshRegistry
      );
    };
  }, []);

  const selectedMarket =
    useMemo(
      () =>
        marketOptions.find(
          (marketOption) =>
            marketOption.ticker ===
            selectedTicker
        ) ??
        marketOptions[0]!,
      [
        marketOptions,
        selectedTicker,
      ]
    );

  const selectedAsset =
    selectedMarket.asset;

  const selectedDeployment =
    selectedMarket.deployment;

  const selectedPoolAddress =
    selectedDeployment
      ?.poolAddress ??
    null;

  const {
    data: livePrice,
  } =
    usePythPrice(
      selectedTicker
    );

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

  const [
    walletBalances,
    setWalletBalances,
  ] =
    useState<WalletTokenBalances | null>(
      null
    );

  function selectMarket(
    ticker: PythEquityTicker
  ) {
    if (
      ticker ===
      selectedTicker
    ) {
      return;
    }

    const nextMarket =
      marketOptions.find(
        (marketOption) =>
          marketOption.ticker ===
          ticker
      );

    setSelectedTicker(
      ticker
    );

    setPool(null);
    setQuote(null);
    setSignature(null);
    setError(null);
    setWalletBalances(null);

    setLoadingPool(
      Boolean(
        nextMarket?.deployment
      )
    );
  }

  const refreshPool =
    useCallback(
      async () => {
        if (
          !selectedPoolAddress
        ) {
          setLoadingPool(
            false
          );
          return;
        }

        setLoadingPool(true);

        try {
          const response =
            await fetch(
              `/api/meteora/pool?pool=${encodeURIComponent(
                selectedPoolAddress
              )}`,
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
      [
        selectedPoolAddress,
      ]
    );

  const refreshWalletBalances =
    useCallback(
      async () => {
        if (
          !publicKey ||
          !pool
        ) {
          return;
        }

        const owner =
          publicKey.toBase58();

        const [
          usdc,
          assetToken,
        ] = await Promise.all([
          getMintBalance({
            connection,
            owner: publicKey,
            mint: pool.addresses.quoteMint,
          }),

          getMintBalance({
            connection,
            owner: publicKey,
            mint: pool.addresses.baseMint,
          }),
        ]);

        setWalletBalances({
          owner,
          usdc,
          assetToken,
        });
      },
      [
        connection,
        publicKey,
        pool,
      ]
    );

  useEffect(() => {
    let cancelled = false;

    if (
      !selectedPoolAddress
    ) {
      return () => {
        cancelled = true;
      };
    }

    const poolAddress =
      selectedPoolAddress;

    async function loadInitialPool() {
      try {
        const response =
          await fetch(
            `/api/meteora/pool?pool=${encodeURIComponent(
              poolAddress
            )}`,
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
  }, [
    selectedPoolAddress,
  ]);

  useEffect(() => {
    let cancelled = false;

    if (!publicKey || !pool) {
      return () => {
        cancelled = true;
      };
    }

    const walletPublicKey =
      publicKey;

    const poolAddresses =
      pool.addresses;

    const owner =
      walletPublicKey.toBase58();

    async function loadWalletBalances() {
      const [
        usdc,
        assetToken,
      ] = await Promise.all([
        getMintBalance({
          connection,
          owner:
            walletPublicKey,
          mint:
            poolAddresses.quoteMint,
        }),

        getMintBalance({
          connection,
          owner:
            walletPublicKey,
          mint:
            poolAddresses.baseMint,
        }),
      ]);

      if (!cancelled) {
        setWalletBalances({
          owner,
          usdc,
          assetToken,
        });
      }
    }

    void loadWalletBalances();

    return () => {
      cancelled = true;
    };
  }, [
    connection,
    publicKey,
    pool,
  ]);

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

  const intelligence =
    useMemo<
      MarketIntelligence | null
    >(() => {
      if (!pool) {
        return null;
      }

      const dbcPrice =
        deriveDbcPrice(
          pool.market.sqrtPrice
        );

      const referencePrice =
        livePrice?.price ??
        null;

      if (
        referencePrice === null ||
        !Number.isFinite(
          referencePrice
        ) ||
        referencePrice <= 0
      ) {
        return {
          dbcPrice,

          referencePrice:
            null,

          premiumPercent:
            null,

          differenceUsd:
            null,

          relationship:
            "unknown",
        };
      }

      const differenceUsd =
        dbcPrice -
        referencePrice;

      const premiumPercent =
        (
          differenceUsd /
          referencePrice
        ) *
        100;

      let relationship:
        MarketIntelligence["relationship"];

      if (
        Math.abs(
          premiumPercent
        ) <= 2
      ) {
        relationship =
          "near";
      } else if (
        premiumPercent <
        0
      ) {
        relationship =
          "below";
      } else {
        relationship =
          "above";
      }

      return {
        dbcPrice,

        referencePrice,

        premiumPercent,

        differenceUsd,

        relationship,
      };
    }, [
      pool,
      livePrice,
    ]);

  const curveZones =
    useMemo(() => {
      if (!pool) {
        return null;
      }

      return deriveCurveZones(
        pool
      );
    }, [pool]);

  const currentWalletBalances =
    useMemo(() => {
      if (!publicKey || !walletBalances) {
        return null;
      }

      return walletBalances.owner ===
        publicKey.toBase58()
        ? walletBalances
        : null;
    }, [
      publicKey,
      walletBalances,
    ]);

  const tradePreview =
    useMemo<TradePreview | null>(() => {
      if (!quote || !curveZones) {
        return null;
      }

      const inputUsdc =
        Number(quote.amountInUi);

      const outputTokens =
        Number(quote.outputAmountUi);

      const postTradeDbcPrice =
        deriveDbcPrice(
          quote.nextSqrtPrice
        );

      if (
        !Number.isFinite(inputUsdc) ||
        inputUsdc <= 0 ||
        !Number.isFinite(outputTokens) ||
        outputTokens <= 0 ||
        !Number.isFinite(postTradeDbcPrice) ||
        postTradeDbcPrice <= 0
      ) {
        return null;
      }

      const currentDbcPrice =
        curveZones.current;

      const priceImpactPercent =
        (
          (
            postTradeDbcPrice /
            currentDbcPrice
          ) -
          1
        ) *
        100;

      const currentZone =
        classifyPriceZone(
          currentDbcPrice,
          curveZones
        );

      const postTradeZone =
        classifyPriceZone(
          postTradeDbcPrice,
          curveZones
        );

      const allInExecutionPrice =
        inputUsdc /
        outputTokens;

      const allInPremiumVsSpot =
        (
          (
            allInExecutionPrice /
            currentDbcPrice
          ) -
          1
        ) *
        100;

      return {
        inputUsdc,
        outputTokens,
        currentDbcPrice,
        postTradeDbcPrice,
        priceImpactPercent,
        currentZone,
        postTradeZone,
        allInExecutionPrice,
        allInPremiumVsSpot,

        estimatedUsdcAfter:
          currentWalletBalances
            ? currentWalletBalances.usdc -
              inputUsdc
            : null,

        estimatedAssetAfter:
          currentWalletBalances
            ? currentWalletBalances.assetToken +
              outputTokens
            : null,
      };
    }, [
      quote,
      curveZones,
      currentWalletBalances,
    ]);

  const insufficientUsdc =
    useMemo(() => {
      if (!currentWalletBalances) {
        return false;
      }

      const inputUsdc =
        Number(amount);

      return (
        Number.isFinite(inputUsdc) &&
        inputUsdc >
          currentWalletBalances.usdc
      );
    }, [
      amount,
      currentWalletBalances,
    ]);

  async function handleQuote() {
    setError(null);
    setSignature(null);
    setQuoting(true);

    try {
      const result =
        await getStockForgeBuyQuote({
          connection,

          poolAddress:
            selectedPoolAddress ??
            (() => {
              throw new Error(
                "Selected market is not deployed."
              );
            })(),

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

          poolAddress:
            selectedPoolAddress ??
            (() => {
              throw new Error(
                "Selected market is not deployed."
              );
            })(),

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

      await Promise.all([
        refreshPool(),
        refreshWalletBalances(),
      ]);
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
    <div className="mx-auto max-w-7xl px-6 pb-24 pt-12 lg:px-8">
      {/* MARKET REGISTRY */}
      <div className="mb-10">
        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.18em] text-emerald-400">
          <BarChart3 className="h-4 w-4" />
          StockForge Markets
        </div>

        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Multi-asset DBC markets
        </h1>

        <p className="mt-4 max-w-3xl text-lg leading-7 text-zinc-400">
          Select a StockForge market to
          compare its live Pyth reference
          with its own Meteora Dynamic
          Bonding Curve and trade the
          deployed asset on devnet.
        </p>
      </div>

      <section className="mb-10 grid gap-4 md:grid-cols-3">
        {marketOptions.map(
          (marketOption) => {
            const selected =
              marketOption.ticker ===
              selectedTicker;

            const deployed =
              marketOption.deployment !==
              null;

            return (
              <button
                key={
                  marketOption.ticker
                }
                type="button"
                onClick={() =>
                  selectMarket(
                    marketOption.ticker
                  )
                }
                className={`rounded-2xl border p-5 text-left transition ${
                  selected
                    ? "border-emerald-400/35 bg-emerald-400/[0.07]"
                    : "border-white/[0.08] bg-[#0d1014] hover:bg-white/[0.03]"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-white">
                      {
                        marketOption
                          .asset
                          .tokenSymbol
                      }
                    </p>

                    <p className="mt-1 text-xs text-zinc-500">
                      {
                        marketOption
                          .asset
                          .referenceName
                      }
                    </p>
                  </div>

                  <span
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] ${
                      deployed
                        ? "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300"
                        : "border-white/10 bg-white/[0.03] text-zinc-600"
                    }`}
                  >
                    {deployed
                      ? "Live DBC"
                      : "Not deployed"}
                  </span>
                </div>

                <p className="mt-4 font-mono text-[11px] text-zinc-600">
                  Pyth ·{" "}
                  {
                    marketOption
                      .ticker
                  }
                </p>
              </button>
            );
          }
        )}
      </section>

      {/* SELECTED MARKET HEADER */}
      <div className="mb-12">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              selectedDeployment
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-white/10 bg-white/[0.03] text-zinc-500"
            }`}
          >
            {selectedDeployment
              ? "DEVNET · LIVE DBC"
              : "DEVNET · NOT DEPLOYED"}
          </span>

          {selectedDeployment &&
          pool?.market.hasSwap ===
          0 ? (
            <span className="text-sm text-zinc-500">
              No trades yet
            </span>
          ) : selectedDeployment &&
            pool ? (
            <span className="text-sm text-emerald-400">
              Trading active
            </span>
          ) : null}
        </div>

        <h2 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          {selectedAsset.tokenSymbol}{" "}
          Market
        </h2>

        <p className="mt-4 max-w-3xl text-lg text-zinc-400">
          {selectedAsset.referenceName}{" "}
          reference intelligence paired
          with its StockForge Meteora DBC
          on Solana devnet.
        </p>
      </div>

      {!selectedDeployment ? (
        <div className="mb-8 rounded-2xl border border-blue-400/20 bg-blue-400/[0.05] p-6">
          <p className="font-medium text-blue-300">
            {selectedAsset.tokenSymbol}{" "}
            has not been deployed yet
          </p>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
            Pyth market data is supported
            for {selectedTicker}, but there
            is no registered StockForge
            Meteora DBC pool for this asset
            yet.
          </p>

          <a
            href="/create"
            className="mt-4 inline-flex rounded-lg border border-blue-400/20 px-3 py-2 text-sm text-blue-300 transition hover:bg-blue-400/[0.06]"
          >
            Open Create Market
          </a>
        </div>
      ) : null}

      {loadingPool &&
      !pool ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-zinc-400">
          Loading on-chain
          pool...
        </div>
      ) : null}

      {selectedDeployment &&
      !loadingPool &&
      !pool &&
      error ? (
        <pre className="mb-8 overflow-x-auto whitespace-pre-wrap rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-xs text-red-300">
          {error}
        </pre>
      ) : null}

      {pool ? (
        <>
          {/* MARKET INTELLIGENCE */}
          {intelligence ? (
            <section className="mb-6 overflow-hidden rounded-[26px] border border-white/[0.08] bg-[#0d1014]">
              <div className="flex flex-col gap-4 border-b border-white/[0.06] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-emerald-400">
                    <BarChart3 className="h-4 w-4" />

                    Market intelligence
                  </div>

                  <p className="mt-1 text-sm text-zinc-500">
                    Live Pyth reference
                    compared with the
                    current on-chain
                    Meteora DBC price.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-1.5 text-xs text-emerald-300">
                    <Radio className="h-3.5 w-3.5" />

                    PYTH LIVE
                  </span>

                  <span className="rounded-full border border-purple-400/20 bg-purple-400/[0.07] px-3 py-1.5 text-xs text-purple-300">
                    METEORA DBC
                  </span>
                </div>
              </div>

              <div className="grid gap-px bg-white/[0.06] sm:grid-cols-2 xl:grid-cols-4">
                <IntelligenceMetric
                  label="Pyth reference"
                  value={
                    intelligence
                      .referencePrice !==
                    null
                      ? formatUsd(
                          intelligence
                            .referencePrice
                        )
                      : "Loading..."
                  }
                  detail={
                    livePrice
                      ?.marketSession
                      ? `${livePrice.marketSession} session`
                      : "External equity reference"
                  }
                />

                <IntelligenceMetric
                  label="DBC curve price"
                  value={formatUsd(
                    intelligence.dbcPrice
                  )}
                  detail="Derived from on-chain sqrtPrice"
                />

                <IntelligenceMetric
                  label="Premium / discount"
                  value={
                    intelligence
                      .premiumPercent !==
                    null
                      ? formatSignedPercent(
                          intelligence
                            .premiumPercent
                        )
                      : "—"
                  }
                  detail={
                    intelligence
                      .differenceUsd !==
                    null
                      ? `${formatUsd(
                          Math.abs(
                            intelligence
                              .differenceUsd
                          )
                        )} ${
                          intelligence
                            .differenceUsd <
                          0
                            ? "below"
                            : "above"
                        } Pyth`
                      : "Waiting for Pyth"
                  }
                  tone={
                    intelligence.relationship
                  }
                />

                <IntelligenceMetric
                  label="Reference relationship"
                  value={
                    intelligence.relationship ===
                    "below"
                      ? "Below reference"
                      : intelligence.relationship ===
                          "above"
                        ? "Above reference"
                        : intelligence.relationship ===
                            "near"
                          ? "Near reference"
                          : "Loading..."
                  }
                  detail={
                    intelligence.relationship ===
                    "below"
                      ? "DBC trades below the external reference"
                      : intelligence.relationship ===
                          "above"
                        ? "DBC trades above the external reference"
                        : intelligence.relationship ===
                            "near"
                          ? "DBC is within ±2% of Pyth"
                          : "Awaiting comparison"
                  }
                  tone={
                    intelligence.relationship
                  }
                />
              </div>

              <div className="border-t border-white/[0.06] px-6 py-4 text-xs leading-5 text-zinc-600">
                DBC price is derived
                directly from Meteora&apos;s
                on-chain Q64.64
                sqrt-price state. It is
                not inferred from the
                reserve ratio.
              </div>
            </section>
          ) : null}

          {/* STOCKFORGE MARKET ZONE */}
          {curveZones ? (
            <section className="mb-6 rounded-[26px] border border-white/[0.08] bg-[#0d1014] p-6 sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.18em] text-emerald-400">
                    StockForge Market Zone
                  </p>

                  <h2 className="mt-3 text-3xl font-semibold text-white">
                    {zoneLabel(
                      curveZones.zone
                    )}
                  </h2>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                    Classified from the
                    actual Meteora curve
                    boundaries stored in
                    this deployed DBC
                    configuration.
                  </p>
                </div>

                <div className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-4 py-2 text-sm font-medium text-emerald-300">
                  Current{" "}
                  {formatUsd(
                    curveZones.current
                  )}
                </div>
              </div>

              <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <ZoneMetric
                  label="Curve start"
                  value={formatUsd(
                    curveZones.start
                  )}
                  detail="Beginning of price discovery"
                />

                <ZoneMetric
                  label="Discovery ends"
                  value={formatUsd(
                    curveZones.discoveryEnd
                  )}
                  detail="Fair Value zone begins"
                />

                <ZoneMetric
                  label="Fair Value ends"
                  value={formatUsd(
                    curveZones.fairValueEnd
                  )}
                  detail="Expansion zone begins"
                />

                <ZoneMetric
                  label="Migration end"
                  value={formatUsd(
                    curveZones.expansionEnd
                  )}
                  detail="Final deployed DBC boundary"
                />
              </div>

              <div className="mt-7">
                <div className="relative h-3 overflow-hidden rounded-full bg-white/[0.05]">
                  <div
                    className="absolute inset-y-0 left-0 bg-amber-400/40"
                    style={{
                      width: `${curveZones.discoveryWidthPercent}%`,
                    }}
                  />

                  <div
                    className="absolute inset-y-0 bg-emerald-400/40"
                    style={{
                      left: `${curveZones.discoveryWidthPercent}%`,
                      width: `${curveZones.fairValueWidthPercent}%`,
                    }}
                  />

                  <div
                    className="absolute inset-y-0 right-0 bg-blue-400/40"
                    style={{
                      width: `${curveZones.expansionWidthPercent}%`,
                    }}
                  />

                  <div
                    className="absolute top-1/2 h-5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_3px_rgba(255,255,255,0.12)]"
                    style={{
                      left: `${curveZones.currentPositionPercent}%`,
                    }}
                    title={`Current DBC price ${formatUsd(
                      curveZones.current
                    )}`}
                  />
                </div>

                <div
                  className="mt-3 grid text-xs"
                  style={{
                    gridTemplateColumns: `${curveZones.discoveryWidthPercent}fr ${curveZones.fairValueWidthPercent}fr ${curveZones.expansionWidthPercent}fr`,
                  }}
                >
                  <span className="text-amber-300">
                    Discovery
                  </span>

                  <span className="text-center text-emerald-300">
                    Fair Value
                  </span>

                  <span className="text-right text-blue-300">
                    Expansion
                  </span>
                </div>

                <p className="mt-4 text-xs leading-5 text-zinc-600">
                  Segment widths and
                  the white marker are
                  derived from the
                  deployed price
                  boundaries. Current
                  position is based on
                  Meteora&apos;s live
                  on-chain sqrtPrice.
                </p>
              </div>
            </section>
          ) : null}

          {/* MARKET STATE */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Metric
              label={`${selectedAsset.tokenSymbol} reserve`}
              value={`${formatRaw(
                pool.market
                  .baseReserveRaw
              )} ${selectedAsset.tokenSymbol}`}
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

          {/* TRADE + ON-CHAIN */}
          <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[26px] border border-white/[0.08] bg-[#0d1014] p-6 sm:p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold text-white">
                  Buy {selectedAsset.tokenSymbol}
                </h2>

                <p className="mt-2 text-sm text-zinc-500">
                  USDC → {selectedAsset.tokenSymbol}
                  through the real
                  deployed Meteora
                  curve.
                </p>
              </div>

              {connected &&
              publicKey ? (
                <div className="mb-6 grid gap-3 sm:grid-cols-2">
                  <WalletMetric
                    label="Wallet USDC"
                    value={
                      currentWalletBalances
                        ? `${formatTokenAmount(
                            currentWalletBalances.usdc
                          )} USDC`
                        : "Loading..."
                    }
                  />

                  <WalletMetric
                    label={`Wallet ${selectedAsset.tokenSymbol}`}
                    value={
                      currentWalletBalances
                        ? `${formatTokenAmount(
                            currentWalletBalances.assetToken
                          )} ${selectedAsset.tokenSymbol}`
                        : "Loading..."
                    }
                  />
                </div>
              ) : null}

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
                    value={`${quote.outputAmountUi} ${selectedAsset.tokenSymbol}`}
                  />

                  <QuoteRow
                    label="Minimum received"
                    value={`${quote.minimumAmountOutUi} ${selectedAsset.tokenSymbol}`}
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

              {tradePreview ? (
                <div className="mt-5 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.04] p-4">
                  <div className="mb-4">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-emerald-400">
                      Trade intelligence
                    </p>

                    <p className="mt-1 text-xs leading-5 text-zinc-600">
                      Post-trade price and zone come directly from Meteora&apos;s quoted nextSqrtPrice. All-in execution uses the full USDC spend divided by quoted output, so it also reflects fees.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <QuoteRow
                      label="Current DBC price"
                      value={formatUsd(
                        tradePreview.currentDbcPrice
                      )}
                    />

                    <QuoteRow
                      label="Quoted post-trade DBC price"
                      value={formatUsd(
                        tradePreview.postTradeDbcPrice
                      )}
                    />

                    <QuoteRow
                      label="Quoted price impact"
                      value={formatSignedPercent(
                        tradePreview.priceImpactPercent
                      )}
                    />

                    <QuoteRow
                      label="Current zone"
                      value={zoneLabel(
                        tradePreview.currentZone
                      )}
                    />

                    <QuoteRow
                      label="Quoted post-trade zone"
                      value={zoneLabel(
                        tradePreview.postTradeZone
                      )}
                    />

                    <QuoteRow
                      label="All-in execution price"
                      value={formatUsd(
                        tradePreview.allInExecutionPrice
                      )}
                    />

                    <QuoteRow
                      label="All-in premium vs current DBC"
                      value={formatSignedPercent(
                        tradePreview.allInPremiumVsSpot
                      )}
                    />

                    <QuoteRow
                      label="Estimated USDC after"
                      value={
                        tradePreview.estimatedUsdcAfter !==
                        null
                          ? `${formatTokenAmount(
                              tradePreview.estimatedUsdcAfter
                            )} USDC`
                          : "Connect wallet"
                      }
                    />

                    <QuoteRow
                      label={`Estimated ${selectedAsset.tokenSymbol} after`}
                      value={
                        tradePreview.estimatedAssetAfter !==
                        null
                          ? `${formatTokenAmount(
                              tradePreview.estimatedAssetAfter
                            )} ${selectedAsset.tokenSymbol}`
                          : "Connect wallet"
                      }
                    />
                  </div>
                </div>
              ) : null}

              {insufficientUsdc ? (
                <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-sm text-amber-300">
                  Connected wallet does not have enough devnet USDC for this trade.
                </div>
              ) : null}

              <button
                onClick={
                  handleTradeButton
                }
                disabled={
                  swapping ||
                  insufficientUsdc ||
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
                    ? insufficientUsdc
                      ? "Insufficient devnet USDC"
                      : quote
                        ? `Buy ${selectedAsset.tokenSymbol}`
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

            <div className="rounded-[26px] border border-white/[0.08] bg-[#0d1014] p-6 sm:p-8">
              <h2 className="text-2xl font-semibold text-white">
                On-chain market
              </h2>

              <div className="mt-7 space-y-5">
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
                  label={`${selectedAsset.tokenSymbol} mint`}
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
                className="mt-7 w-full rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-50"
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

function IntelligenceMetric({
  label,
  value,
  detail,
  tone = "unknown",
}: {
  label: string;
  value: string;
  detail: string;

  tone?:
    | "below"
    | "near"
    | "above"
    | "unknown";
}) {
  const Icon =
    tone === "below"
      ? ArrowDownRight
      : tone === "above"
        ? ArrowUpRight
        : tone === "near"
          ? Activity
          : CircleDollarSign;

  return (
    <div className="bg-[#0d1014] p-6">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-zinc-600">
        <Icon className="h-4 w-4" />

        {label}
      </div>

      <p className="mt-4 text-2xl font-semibold tracking-tight text-white">
        {value}
      </p>

      <p className="mt-2 text-xs leading-5 text-zinc-600">
        {detail}
      </p>
    </div>
  );
}

function zoneLabel(
  zone: StockForgeZone
) {
  switch (zone) {
    case "discovery":
      return "Discovery";

    case "fairValue":
      return "Fair Value";

    case "expansion":
      return "Expansion";

    default:
      return "Outside curve";
  }
}

function ZoneMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-5">
      <p className="text-xs uppercase tracking-[0.14em] text-zinc-600">
        {label}
      </p>

      <p className="mt-3 text-xl font-semibold text-white">
        {value}
      </p>

      <p className="mt-2 text-xs leading-5 text-zinc-600">
        {detail}
      </p>
    </div>
  );
}

function WalletMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/20 p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-zinc-600">
        {label}
      </p>

      <p className="mt-2 text-base font-medium text-white">
        {value}
      </p>
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
    <div className="rounded-2xl border border-white/10 bg-[#0d1014] p-5">
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