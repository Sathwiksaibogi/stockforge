"use client";

import type {
  WalletContextState,
} from "@solana/wallet-adapter-react";

import {
  Connection,
  Keypair,
  PublicKey,
  SendTransactionError,
  Transaction,
} from "@solana/web3.js";

import {
  DynamicBondingCurveClient,
  deriveDbcPoolAddress,
} from "@meteora-ag/dynamic-bonding-curve-sdk";

import type {
  CalibratedMeteoraCurve,
} from "./calibrate-stockforge";

import type {
  PythEquityTicker,
} from "@/lib/pyth/feeds";

export const DEVNET_USDC_MINT =
  new PublicKey(
    "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
  );

const DEVNET_GENESIS_HASH =
  "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";

const DEPLOYMENT_REGISTRY_KEY =
  "stockforge:deployments";

const LAST_DEPLOYMENT_KEY =
  "stockforge:last-deployment";

export type DeploymentPhase =
  | "checking-network"
  | "creating-config"
  | "confirming-config"
  | "creating-pool"
  | "confirming-pool"
  | "verifying"
  | "complete";

export type StockForgeDeploymentResult = {
  cluster: "devnet";

  ticker: PythEquityTicker;

  tokenName: string;

  tokenSymbol: string;

  configAddress: string;

  baseMintAddress: string;

  poolAddress: string;

  quoteMintAddress: string;

  configSignature: string;

  poolSignature: string;

  metadataUri: string;

  deployedAt: number;
};

type DeployStockForgeMarketParams = {
  connection: Connection;

  walletPublicKey: PublicKey;

  signTransaction:
    WalletSignTransaction;

  calibrated:
    CalibratedMeteoraCurve;

  ticker: PythEquityTicker;

  metadataUri: string;

  name: string;

  symbol: string;

  onPhase?: (
    phase: DeploymentPhase
  ) => void;
};

type WalletSignTransaction =
  NonNullable<
    WalletContextState["signTransaction"]
  >;

async function signSendAndConfirm({
  connection,
  transaction,
  walletPublicKey,
  additionalSigner,
  signTransaction,
  onSubmitted,
}: {
  connection: Connection;
  transaction: Transaction;
  walletPublicKey: PublicKey;
  additionalSigner: Keypair;
  signTransaction: WalletSignTransaction;
  onSubmitted?: () => void;
}) {
  const {
    context,
    value: latestBlockhash,
  } =
    await connection.getLatestBlockhashAndContext(
      "confirmed"
    );

  transaction.feePayer =
    walletPublicKey;

  transaction.recentBlockhash =
    latestBlockhash.blockhash;

  transaction.partialSign(
    additionalSigner
  );

  const signedTransaction =
    await signTransaction(
      transaction
    );

  let signature: string;

  try {
    signature =
      await connection.sendRawTransaction(
        signedTransaction.serialize(),
        {
          skipPreflight: false,
          preflightCommitment:
            "confirmed",
          maxRetries: 5,
          minContextSlot:
            context.slot,
        }
      );
  } catch (error) {
    if (
      error instanceof
      SendTransactionError
    ) {
      const logs =
        await error.getLogs(
          connection
        );

      throw new Error(
        [
          `Solana preflight rejected the transaction: ${error.message}`,
          ...(logs ?? []),
        ].join("\n")
      );
    }

    throw error;
  }

  onSubmitted?.();

  const confirmation =
    await connection.confirmTransaction(
      {
        signature,
        blockhash:
          latestBlockhash.blockhash,
        lastValidBlockHeight:
          latestBlockhash.lastValidBlockHeight,
      },
      "confirmed"
    );

  if (
    confirmation.value.err
  ) {
    throw new Error(
      `Transaction failed on-chain: ${JSON.stringify(
        confirmation.value.err
      )}`
    );
  }

  return signature;
}

async function waitForAccount(
  connection: Connection,
  address: PublicKey
) {
  for (
    let attempt = 0;
    attempt < 12;
    attempt++
  ) {
    const account =
      await connection.getAccountInfo(
        address,
        "confirmed"
      );

    if (account) {
      return;
    }

    await new Promise(
      (resolve) =>
        window.setTimeout(
          resolve,
          500
        )
    );
  }

  throw new Error(
    `Account ${address.toBase58()} was not visible after confirmation.`
  );
}

async function assertDevnet(
  connection: Connection
) {
  const genesisHash =
    await connection.getGenesisHash();

  if (
    genesisHash !==
    DEVNET_GENESIS_HASH
  ) {
    throw new Error(
      "StockForge deployment is currently locked to Solana devnet."
    );
  }
}

function persistDeployment(
  result: StockForgeDeploymentResult
) {
  window.localStorage.setItem(
    LAST_DEPLOYMENT_KEY,
    JSON.stringify(result)
  );

  let existing:
    StockForgeDeploymentResult[] =
    [];

  try {
    const stored =
      window.localStorage.getItem(
        DEPLOYMENT_REGISTRY_KEY
      );

    const parsed =
      stored
        ? JSON.parse(stored)
        : [];

    if (Array.isArray(parsed)) {
      existing =
        parsed.filter(
          (
            item
          ): item is StockForgeDeploymentResult =>
            typeof item ===
              "object" &&
            item !== null &&
            typeof (
              item as {
                poolAddress?: unknown;
              }
            ).poolAddress ===
              "string"
        );
    }
  } catch {
    existing = [];
  }

  const withoutDuplicate =
    existing.filter(
      (item) =>
        item.poolAddress !==
        result.poolAddress
    );

  window.localStorage.setItem(
    DEPLOYMENT_REGISTRY_KEY,
    JSON.stringify([
      result,
      ...withoutDuplicate,
    ])
  );
}

export async function deployStockForgeMarket({
  connection,
  walletPublicKey,
  signTransaction,
  calibrated,
  ticker,
  metadataUri,
  name,
  symbol,
  onPhase,
}: DeployStockForgeMarketParams): Promise<StockForgeDeploymentResult> {
  onPhase?.(
    "checking-network"
  );

  await assertDevnet(
    connection
  );

  if (
    !metadataUri.startsWith(
      "https://"
    )
  ) {
    throw new Error(
      "Token metadata URI must be a public HTTPS URL."
    );
  }

  if (!name.trim()) {
    throw new Error(
      "Token name is required."
    );
  }

  if (!symbol.trim()) {
    throw new Error(
      "Token symbol is required."
    );
  }

  const client =
    DynamicBondingCurveClient.create(
      connection,
      "confirmed"
    );

  const configKeypair =
    Keypair.generate();

  const baseMintKeypair =
    Keypair.generate();

  onPhase?.(
    "creating-config"
  );

  const createConfigTx =
    await client.partner.createConfig({
      config:
        configKeypair.publicKey,

      feeClaimer:
        walletPublicKey,

      leftoverReceiver:
        walletPublicKey,

      payer:
        walletPublicKey,

      quoteMint:
        DEVNET_USDC_MINT,

      ...calibrated.meteoraConfig,
    });

  const configSignature =
    await signSendAndConfirm({
      connection,

      transaction:
        createConfigTx,

      walletPublicKey,

      additionalSigner:
        configKeypair,

      signTransaction,

      onSubmitted: () =>
        onPhase?.(
          "confirming-config"
        ),
    });

  await waitForAccount(
    connection,
    configKeypair.publicKey
  );

  onPhase?.(
    "creating-pool"
  );

  const createPoolTx =
    await client.creator.createPool({
      name,

      symbol,

      uri:
        metadataUri,

      payer:
        walletPublicKey,

      poolCreator:
        walletPublicKey,

      config:
        configKeypair.publicKey,

      baseMint:
        baseMintKeypair.publicKey,
    });

  const poolSignature =
    await signSendAndConfirm({
      connection,

      transaction:
        createPoolTx,

      walletPublicKey,

      additionalSigner:
        baseMintKeypair,

      signTransaction,

      onSubmitted: () =>
        onPhase?.(
          "confirming-pool"
        ),
    });

  const poolAddress =
    deriveDbcPoolAddress(
      DEVNET_USDC_MINT,
      baseMintKeypair.publicKey,
      configKeypair.publicKey
    );

  onPhase?.(
    "verifying"
  );

  await waitForAccount(
    connection,
    poolAddress
  );

  const poolState =
    await client.state.getPool(
      poolAddress
    );

  if (!poolState) {
    throw new Error(
      "Meteora pool transaction confirmed but pool state could not be loaded."
    );
  }

  const configState =
    await client.state.getPoolConfig(
      configKeypair.publicKey
    );

  if (!configState) {
    throw new Error(
      "Meteora config transaction confirmed but config state could not be loaded."
    );
  }

  const result:
    StockForgeDeploymentResult = {
      cluster:
        "devnet",

      ticker,

      tokenName:
        name,

      tokenSymbol:
        symbol,

      configAddress:
        configKeypair.publicKey.toBase58(),

      baseMintAddress:
        baseMintKeypair.publicKey.toBase58(),

      poolAddress:
        poolAddress.toBase58(),

      quoteMintAddress:
        DEVNET_USDC_MINT.toBase58(),

      configSignature,

      poolSignature,

      metadataUri,

      deployedAt:
        Date.now(),
    };

  persistDeployment(
    result
  );

  onPhase?.(
    "complete"
  );

  return result;
}
