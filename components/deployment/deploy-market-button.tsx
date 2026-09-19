"use client";

import {
  useState,
} from "react";

import {
  ExternalLink,
  Loader2,
  Rocket,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

import {
  useConnection,
  useWallet,
} from "@solana/wallet-adapter-react";

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
  deployStockForgeMarket,
} from "@/lib/meteora/deploy-stockforge";

import type {
  DeploymentPhase,
  StockForgeDeploymentResult,
} from "@/lib/meteora/deploy-stockforge";

import type {
  PythEquityTicker,
} from "@/lib/pyth/feeds";

import {
  getStockForgeAsset,
  getStockForgeMetadataUri,
} from "@/lib/stockforge/assets";

type Props = {
  ticker: PythEquityTicker;

  referencePrice: number;

  annualizedVolatility: number;

  targetRaiseUsd: number;

  graduationUsd: number;

  totalSupply: number;

  riskProfile: RiskProfile;
};

const PHASE_LABELS:
  Record<
    DeploymentPhase,
    string
  > = {
    "checking-network":
      "Checking Solana network...",

    "creating-config":
      "Approve DBC config transaction...",

    "confirming-config":
      "Confirming DBC config...",

    "creating-pool":
      "Approve pool creation transaction...",

    "confirming-pool":
      "Confirming StockForge market...",

    verifying:
      "Verifying Meteora accounts...",

    complete:
      "Market deployed",
  };

export function DeployMarketButton({
  ticker,
  referencePrice,
  annualizedVolatility,
  targetRaiseUsd,
  graduationUsd,
  totalSupply,
  riskProfile,
}: Props) {
  const {
    connection,
  } =
    useConnection();

  const {
    publicKey,
    connected,
    signTransaction,
  } =
    useWallet();

  const asset =
    getStockForgeAsset(
      ticker
    );

  const [
    phase,
    setPhase,
  ] =
    useState<
      DeploymentPhase | null
    >(null);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );

  const [
    result,
    setResult,
  ] =
    useState<StockForgeDeploymentResult | null>(
      null
    );

  const deploying =
    phase !== null &&
    phase !== "complete";

  async function deploy() {
    try {
      setError(null);
      setResult(null);

      if (
        !connected ||
        !publicKey ||
        !signTransaction
      ) {
        throw new Error(
          "Connect a wallet that supports transaction signing before deploying."
        );
      }

      const metadataUri =
        getStockForgeMetadataUri(
          ticker
        );

      const curve =
        compileStockForgeCurve({
          referencePrice,

          annualizedVolatility,

          targetRaiseUsd,

          graduationThresholdUsd:
            graduationUsd,

          riskProfile,
        });

      const calibrated =
        calibrateStockForgeToMeteora(
          curve,
          graduationUsd,
          totalSupply
        );

      const deployment =
        await deployStockForgeMarket({
          connection,

          walletPublicKey:
            publicKey,

          signTransaction,

          calibrated,

          ticker,

          metadataUri,

          name:
            asset.tokenName,

          symbol:
            asset.tokenSymbol,

          onPhase:
            setPhase,
        });

      setResult(
        deployment
      );
    } catch (caught) {
      console.error(
        "StockForge deployment failed:",
        caught
      );

      setPhase(null);

      setError(
        caught instanceof Error
          ? caught.message
          : "Unknown deployment error."
      );
    }
  }

  if (result) {
    return (
      <div className="mt-8 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />

          <div className="min-w-0 flex-1">
            <p className="font-medium text-emerald-300">
              {result.tokenSymbol} market deployed
            </p>

            <p className="mt-2 text-sm text-zinc-500">
              The {result.ticker} StockForge
              Meteora DBC config and pool are
              live on Solana devnet.
            </p>

            <div className="mt-5 space-y-3 font-mono text-xs">
              <AddressRow
                label="Reference asset"
                value={
                  result.ticker
                }
              />

              <AddressRow
                label="Token"
                value={
                  result.tokenSymbol
                }
              />

              <AddressRow
                label="Config"
                value={
                  result.configAddress
                }
              />

              <AddressRow
                label="Base mint"
                value={
                  result.baseMintAddress
                }
              />

              <AddressRow
                label="DBC pool"
                value={
                  result.poolAddress
                }
              />
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href={`https://explorer.solana.com/tx/${result.configSignature}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 transition hover:bg-white/[0.05]"
              >
                Config transaction

                <ExternalLink className="h-3 w-3" />
              </a>

              <a
                href={`https://explorer.solana.com/tx/${result.poolSignature}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 transition hover:bg-white/[0.05]"
              >
                Pool transaction

                <ExternalLink className="h-3 w-3" />
              </a>

              <a
                href={`https://explorer.solana.com/address/${result.poolAddress}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 transition hover:bg-white/[0.05]"
              >
                View DBC pool

                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mt-8 rounded-2xl border border-white/[0.07] bg-black/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-zinc-200">
              Deploy {asset.tokenSymbol}
            </p>

            <p className="mt-1 text-xs leading-5 text-zinc-600">
              Uses the frozen {ticker} Pyth snapshot
              and creates a new asset-specific Meteora
              DBC on devnet.
            </p>
          </div>

          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-1 text-xs text-emerald-300">
            {ticker} · DEVNET
          </span>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex gap-3 rounded-xl border border-red-400/20 bg-red-400/[0.05] p-4 text-sm text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

          <span>
            {error}
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={() =>
          void deploy()
        }
        disabled={
          deploying
        }
        className="mt-4 flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 font-semibold text-[#04110c] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
      >
        {deploying ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />

            {phase
              ? PHASE_LABELS[
                  phase
                ]
              : "Deploying..."}
          </>
        ) : (
          <>
            <Rocket className="h-4 w-4" />

            Deploy {asset.tokenSymbol} on devnet
          </>
        )}
      </button>

      <p className="mt-3 text-center text-[11px] text-zinc-700">
        Creates a new token mint, Meteora DBC config,
        and pool. Requires two wallet approvals.
      </p>
    </>
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
    <div>
      <p className="text-zinc-600">
        {label}
      </p>

      <p className="mt-1 break-all text-zinc-300">
        {value}
      </p>
    </div>
  );
}
