"use client";

import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import Link from "next/link";

import {
  ArrowRight,
  Building2,
  Database,
  ExternalLink,
  Landmark,
  Radio,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import {
  usePythPrice,
} from "@/hooks/use-pyth-price";

import {
  PYTH_EQUITY_FEEDS,
  type PythEquityTicker,
} from "@/lib/pyth/feeds";

import {
  STOCKFORGE_ASSETS,
} from "@/lib/stockforge/assets";

type PreStocksSuccess = {
  status: "ok";
  ticker: string;
  company: string;
  category: string;
  productUrl: string;
  mint: string;
  cluster: "mainnet-beta";
  tokenProgram: "Token-2022";
  tokenProgramAddress: string;
  decimals: number;
  supplyRaw: string;
  supplyUi: string;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  extensions: string[];
  metadata: {
    name: string;
    symbol: string;
    uri: string | null;
  };
};

type PreStocksFailure = {
  status: "error";
  ticker: string;
  company: string;
  category: string;
  productUrl: string;
  mint: string;
  cluster: "mainnet-beta";
  error: string;
};

type PreStocksAsset =
  | PreStocksSuccess
  | PreStocksFailure;

type PreStocksResponse = {
  source: string;
  cluster: "mainnet-beta";
  mode: "read-only";
  fetchedAt: string;
  status:
    | "ok"
    | "partial"
    | "unavailable";
  assets: PreStocksAsset[];
};

const PUBLIC_TICKERS:
  PythEquityTicker[] = [
    "TSLA",
    "QQQ",
    "VOO",
  ];

function formatMoney(
  value: number
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      maximumFractionDigits:
        2,
    }
  ).format(value);
}

function formatSupply(
  value: string
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(number)
  ) {
    return value;
  }

  return new Intl.NumberFormat(
    "en-US",
    {
      maximumFractionDigits:
        6,
    }
  ).format(number);
}

function truncateAddress(
  value: string
) {
  return `${value.slice(
    0,
    6
  )}...${value.slice(-6)}`;
}

export default function ExplorePage() {
  const [
    prestocks,
    setPreStocks,
  ] =
    useState<PreStocksResponse | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );

  const loadPreStocks =
    useCallback(async () => {
      setLoading(true);

      try {
        const response =
          await fetch(
            "/api/prestocks",
            {
              cache:
                "no-store",
            }
          );

        const json =
          await response.json();

        if (!response.ok) {
          throw new Error(
            json.error ??
              "Unable to load PreStocks data."
          );
        }

        setPreStocks(
          json as PreStocksResponse
        );

        setError(null);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load PreStocks data."
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    const initialRequest =
      window.setTimeout(
        () => {
          void loadPreStocks();
        },
        0
      );

    return () => {
      window.clearTimeout(
        initialRequest
      );
    };
  }, [
    loadPreStocks,
  ]);

  return (
    <main className="min-h-screen bg-[#07090c] text-white">
      <div className="mx-auto max-w-7xl px-6 pb-24 pt-12 lg:px-8">
        <div className="max-w-4xl">
          <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-[0.18em] text-emerald-400">
            <Landmark className="h-4 w-4" />
            StockForge Explore
          </div>

          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
            Public and private markets,
            one intelligence layer.
          </h1>

          <p className="mt-5 max-w-3xl text-base leading-7 text-zinc-400">
            StockForge combines live public-market
            references from Pyth with read-only
            on-chain intelligence from real
            PreStocks Token-2022 assets on Solana
            mainnet.
          </p>
        </div>

        <section className="mt-12">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-400">
                <Radio className="h-4 w-4" />
                Pyth public markets
              </div>

              <h2 className="mt-2 text-2xl font-semibold">
                StockForge launch references
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-500">
                These assets can flow through
                StockForge&apos;s volatility-aware
                compiler, Meteora DBC simulation,
                deployment, and trading pipeline.
              </p>
            </div>

            <Link
              href="/create"
              className="inline-flex items-center gap-2 text-sm font-medium text-emerald-300 transition hover:text-emerald-200"
            >
              Open Curve Compiler
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {PUBLIC_TICKERS.map(
              (ticker) => (
                <PublicMarketCard
                  key={ticker}
                  ticker={ticker}
                />
              )
            )}
          </div>
        </section>

        <section className="mt-14">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-purple-300">
                <Building2 className="h-4 w-4" />
                PreStocks private markets
              </div>

              <h2 className="mt-2 text-2xl font-semibold">
                Real Token-2022 asset intelligence
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
                StockForge reads the actual PreStocks
                mint accounts from Solana mainnet and
                exposes Token-2022 metadata, supply,
                decimals, authorities, and active mint
                extensions.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                void loadPreStocks()
              }
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 transition hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  loading
                    ? "animate-spin"
                    : ""
                }`}
              />
              Refresh mainnet
            </button>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Badge>SOLANA MAINNET · READ ONLY</Badge>
            <Badge>TOKEN-2022</Badge>
            <Badge>PRESTOCKS</Badge>
          </div>

          {loading &&
          !prestocks ? (
            <div className="mt-6 rounded-2xl border border-white/[0.07] bg-[#0d1014] p-8 text-sm text-zinc-500">
              Reading PreStocks Token-2022
              mints from Solana mainnet...
            </div>
          ) : null}

          {error ? (
            <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-5 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          {prestocks ? (
            <div className="mt-6 grid gap-5 lg:grid-cols-3">
              {prestocks.assets.map(
                (asset) => (
                  <PreStocksCard
                    key={asset.ticker}
                    asset={asset}
                  />
                )
              )}
            </div>
          ) : null}

          {prestocks ? (
            <p className="mt-4 text-xs text-zinc-700">
              Mainnet snapshot fetched{" "}
              {new Date(
                prestocks.fetchedAt
              ).toLocaleString()}
              .
            </p>
          ) : null}
        </section>

        <section className="mt-14 overflow-hidden rounded-[26px] border border-white/[0.08] bg-[#0d1014]">
          <div className="grid lg:grid-cols-2">
            <div className="border-b border-white/[0.06] p-7 lg:border-b-0 lg:border-r">
              <div className="flex items-center gap-2 text-sm font-medium text-purple-300">
                <Database className="h-4 w-4" />
                Private-market intelligence
              </div>

              <p className="mt-4 text-sm leading-7 text-zinc-500">
                PreStocks assets are read directly
                from Solana mainnet. StockForge does
                not mint replacement private-company
                tokens or treat a Devnet demo token
                as equivalent to a PreStocks position.
              </p>
            </div>

            <div className="p-7">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-400">
                <ShieldCheck className="h-4 w-4" />
                Protocol boundary
              </div>

              <p className="mt-4 text-sm leading-7 text-zinc-500">
                StockForge&apos;s Pyth → compiler →
                Meteora DBC workflow remains locked
                to Solana Devnet. The PreStocks
                integration is deliberately read-only
                on mainnet, separating sponsor
                intelligence from demo transactions.
              </p>
            </div>
          </div>
        </section>

        <div className="mt-8 rounded-2xl border border-amber-400/10 bg-amber-400/[0.03] p-5 text-xs leading-6 text-zinc-600">
          PreStocks provide economic exposure to
          private companies and do not confer direct
          ownership, voting, dividend, or similar
          company rights. Availability and eligibility
          restrictions may apply. StockForge presents
          this information for product demonstration
          and on-chain analysis only.
        </div>
      </div>
    </main>
  );
}

function PublicMarketCard({
  ticker,
}: {
  ticker: PythEquityTicker;
}) {
  const {
    data,
    loading,
    error,
  } =
    usePythPrice(
      ticker,
      20_000
    );

  const feed =
    PYTH_EQUITY_FEEDS[
      ticker
    ];

  const asset =
    STOCKFORGE_ASSETS[
      ticker
    ];

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0d1014] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xl font-semibold">
            {ticker}
          </p>

          <p className="mt-1 text-xs text-zinc-600">
            {feed.name}
          </p>
        </div>

        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-emerald-300">
          Pyth live
        </span>
      </div>

      <div className="mt-6">
        <p className="text-xs uppercase tracking-[0.14em] text-zinc-600">
          Reference
        </p>

        <p className="mt-2 text-2xl font-semibold">
          {loading &&
          !data
            ? "Loading..."
            : data
              ? formatMoney(
                  data.price
                )
              : "Unavailable"}
        </p>

        <p className="mt-1 text-xs text-zinc-600">
          {data?.marketSession
            ? `${data.marketSession} session`
            : error
              ? error
              : feed.symbol}
        </p>
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-white/[0.06] pt-4">
        <span className="text-xs text-zinc-600">
          {asset.tokenSymbol}
        </span>

        <Link
          href="/create"
          className="text-sm font-medium text-emerald-300 transition hover:text-emerald-200"
        >
          Compile
        </Link>
      </div>
    </div>
  );
}

function PreStocksCard({
  asset,
}: {
  asset:
    PreStocksAsset;
}) {
  if (
    asset.status ===
    "error"
  ) {
    return (
      <div className="rounded-2xl border border-red-400/15 bg-[#0d1014] p-5">
        <p className="text-lg font-semibold">
          {asset.company}
        </p>

        <p className="mt-1 text-xs text-zinc-600">
          {asset.ticker} · PreStocks
        </p>

        <p className="mt-5 text-sm leading-6 text-red-300">
          {asset.error}
        </p>

        <ExternalLinks
          mint={asset.mint}
          productUrl={asset.productUrl}
        />
      </div>
    );
  }

  const hasTransferHook =
    asset.extensions.some(
      (extension) =>
        extension
          .toLowerCase()
          .includes(
            "transferhook"
          )
    );

  return (
    <div className="rounded-2xl border border-purple-400/15 bg-[#0d1014] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold">
            {asset.metadata.name}
          </p>

          <p className="mt-1 text-xs text-zinc-600">
            {asset.category} ·{" "}
            {asset.metadata.symbol}
          </p>
        </div>

        <span className="rounded-full border border-purple-400/20 bg-purple-400/[0.07] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-purple-300">
          Mainnet
        </span>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <PrivateMetric
          label="Supply"
          value={formatSupply(
            asset.supplyUi
          )}
        />

        <PrivateMetric
          label="Decimals"
          value={asset.decimals.toString()}
        />

        <PrivateMetric
          label="Program"
          value="Token-2022"
        />

        <PrivateMetric
          label="Extensions"
          value={asset.extensions.length.toString()}
        />
      </div>

      <div className="mt-5">
        <p className="text-xs uppercase tracking-[0.14em] text-zinc-600">
          Mint
        </p>

        <p
          className="mt-2 font-mono text-sm text-zinc-300"
          title={asset.mint}
        >
          {truncateAddress(
            asset.mint
          )}
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {hasTransferHook ? (
          <span className="rounded-full border border-blue-400/20 bg-blue-400/[0.06] px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-blue-300">
            Transfer Hook
          </span>
        ) : null}

        {asset.extensions
          .filter(
            (extension) =>
              !(
                hasTransferHook &&
                extension
                  .toLowerCase()
                  .includes(
                    "transferhook"
                  )
              )
          )
          .slice(0, 3)
          .map(
            (extension) => (
              <span
                key={extension}
                className="rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[10px] text-zinc-500"
              >
                {extension}
              </span>
            )
          )}

        {asset.extensions.length >
        4 ? (
          <span className="rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[10px] text-zinc-600">
            +
            {asset.extensions.length -
              4}{" "}
            more
          </span>
        ) : null}
      </div>

      <ExternalLinks
        mint={asset.mint}
        productUrl={asset.productUrl}
      />
    </div>
  );
}

function PrivateMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
      <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">
        {label}
      </p>

      <p className="mt-2 text-sm font-medium text-zinc-200">
        {value}
      </p>
    </div>
  );
}

function ExternalLinks({
  mint,
  productUrl,
}: {
  mint: string;
  productUrl: string;
}) {
  return (
    <div className="mt-6 flex flex-wrap gap-3 border-t border-white/[0.06] pt-4">
      <a
        href={productUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-purple-300 transition hover:text-purple-200"
      >
        PreStocks
        <ExternalLink className="h-3 w-3" />
      </a>

      <a
        href={`https://explorer.solana.com/address/${mint}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition hover:text-zinc-300"
      >
        Solana Explorer
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

function Badge({
  children,
}: {
  children:
    ReactNode;
}) {
  return (
    <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.13em] text-zinc-500">
      {children}
    </span>
  );
}
