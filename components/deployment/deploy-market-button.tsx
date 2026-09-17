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

type Props = {
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
    sendTransaction,
  } =
    useWallet();

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
        !publicKey
      ) {
        throw new Error(
          "Connect your Solana wallet before deploying."
        );
      }

      const metadataUri =
        process.env
          .NEXT_PUBLIC_STOCKFORGE_METADATA_URI;

      if (!metadataUri) {
        throw new Error(
          "NEXT_PUBLIC_STOCKFORGE_METADATA_URI is not configured."
        );
      }

      /*
       * Rebuild the EXACT frozen market,
       * not the current live Pyth market.
       */
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

          sendTransaction,

          calibrated,

          metadataUri,

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
              StockForge market deployed
            </p>

            <p className="mt-2 text-sm text-zinc-500">
              Your Meteora DBC config and
              pool are live on Solana
              devnet.
            </p>

            <div className="mt-5 space-y-3 font-mono text-xs">
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
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="mt-8 flex gap-3 rounded-xl border border-red-400/20 bg-red-400/[0.05] p-4 text-sm text-red-300">
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
        className="mt-8 flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 font-semibold text-[#04110c] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
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

            Deploy DBC market on devnet
          </>
        )}
      </button>

      <p className="mt-3 text-center text-[11px] text-zinc-700">
        Creates real Solana accounts and
        requires two wallet approvals.
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