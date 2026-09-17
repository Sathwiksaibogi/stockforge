import Link from "next/link";

import {
  Activity,
  ArrowRight,
  BarChart3,
  CircleDollarSign,
  Gauge,
  LineChart,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";

import { Navbar } from "@/components/navbar";

import { LiveReferenceCard } from "@/components/market/live-reference-card";



const features = [
  {
    icon: LineChart,
    title: "Market-aware curves",
    description:
      "Translate real equity market conditions into purpose-built Meteora DBC configurations.",
  },
  {
    icon: Gauge,
    title: "Pre-launch simulation",
    description:
      "Model price impact, execution quality and curve behaviour before deploying liquidity.",
  },
  {
    icon: BarChart3,
    title: "Live reference monitoring",
    description:
      "Compare the on-chain market against external reference prices continuously.",
  },
  {
    icon: ShieldCheck,
    title: "Fair Value Guard",
    description:
      "Show investors the premium, discount and expected execution deviation before a trade.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#07090c] text-white">
      <Navbar />

      <section className="relative">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute left-[-12rem] top-32 h-[32rem] w-[32rem] rounded-full bg-emerald-500/10 blur-[140px]" />
          <div className="absolute right-[-10rem] top-20 h-[30rem] w-[30rem] rounded-full bg-blue-500/10 blur-[140px]" />
        </div>

        <div className="relative mx-auto grid min-h-[850px] max-w-7xl items-center gap-16 px-6 pb-20 pt-36 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
          <div>
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-4 py-2 text-sm text-emerald-300">
              <Sparkles className="h-4 w-4" />
              Market-aware liquidity infrastructure
            </div>

            <h1 className="max-w-4xl text-5xl font-semibold leading-[1.02] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl">
              Tokenized stocks
              <span className="block text-zinc-500">
                shouldn&apos;t launch like memecoins.
              </span>
            </h1>

            <p className="mt-8 max-w-2xl text-lg leading-8 text-zinc-400">
              StockForge transforms real financial-market data into
              equity-oriented Meteora bonding curves, helping issuers launch
              better price discovery and helping investors understand
              on-chain valuation before they trade.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/create"
                className="inline-flex h-13 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-6 font-semibold text-[#04110c] transition hover:bg-emerald-300"
              >
                Launch a market
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/explore"
                className="inline-flex h-13 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-6 font-medium text-zinc-200 transition hover:bg-white/[0.07]"
              >
                Explore markets
              </Link>
            </div>

            <div className="mt-14 flex flex-wrap gap-x-8 gap-y-4 text-sm text-zinc-500">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-emerald-400" />
                Powered by Solana
              </div>

              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-purple-400" />
                Meteora DBC
              </div>

              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-400" />
                Pyth market data
              </div>
            </div>
          </div>

          <LiveReferenceCard />

        </div>
      </section>

      <section className="border-y border-white/[0.06] bg-white/[0.015]">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-400">
              The problem
            </p>

            <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
              Stocks arrive with market information.
              <span className="text-zinc-500">
                {" "}
                Their liquidity design should use it.
              </span>
            </h2>

            <p className="mt-6 leading-7 text-zinc-400">
              Generic launch tools treat every asset like a purely speculative
              token. StockForge uses reference prices, volatility and capital
              requirements to construct more appropriate price-discovery
              environments for equity-like assets.
            </p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-white/[0.07] bg-[#0d1014] p-6"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/10">
                    <Icon className="h-5 w-5 text-emerald-400" />
                  </div>

                  <h3 className="mt-5 font-medium">
                    {feature.title}
                  </h3>

                  <p className="mt-3 text-sm leading-6 text-zinc-500">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
        <div className="overflow-hidden rounded-[30px] border border-white/10 bg-gradient-to-br from-emerald-400/[0.08] via-[#0d1014] to-blue-400/[0.06] px-8 py-14 sm:px-14">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_auto]">
            <div>
              <div className="flex items-center gap-2 text-sm text-emerald-400">
                <CircleDollarSign className="h-4 w-4" />
                Issuer infrastructure
              </div>

              <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
                From market intelligence to a live Solana market.
              </h2>

              <p className="mt-5 max-w-2xl leading-7 text-zinc-400">
                Analyze the reference asset, compile a liquidity curve,
                simulate investor demand, and deploy through Meteora DBC.
              </p>
            </div>

            <Link
              href="/create"
              className="inline-flex h-13 items-center justify-center gap-2 rounded-xl bg-white px-6 font-semibold text-black transition hover:bg-zinc-200"
            >
              Build a curve
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 px-6 py-8 text-xs text-zinc-600 sm:flex-row lg:px-8">
          <span>
            StockForge — market-aware tokenized equity infrastructure.
          </span>

          <span>
            Built on Solana · Meteora · Pyth
          </span>
        </div>
      </footer>
    </main>
  );
}