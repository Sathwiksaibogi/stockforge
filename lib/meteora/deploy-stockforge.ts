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

export const DEVNET_USDC_MINT =
  new PublicKey(
    "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
  );

const DEVNET_GENESIS_HASH =
  "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";

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

  configAddress: string;

  baseMintAddress: string;

  poolAddress: string;

  quoteMintAddress: string;

  configSignature: string;

  poolSignature: string;

  metadataUri: string;
};

type DeployStockForgeMarketParams = {
  connection: Connection;

  walletPublicKey: PublicKey;

  signTransaction:
  WalletSignTransaction;

  calibrated:
    CalibratedMeteoraCurve;

  metadataUri: string;

  name?: string;

  symbol?: string;

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
}: {
  connection: Connection;
  transaction: Transaction;
  walletPublicKey: PublicKey;
  additionalSigner: Keypair;
  signTransaction: WalletSignTransaction;
}) {
  /*
   * Get the blockhash immediately before
   * asking Phantom to sign.
   */
  const {
    context,
    value: latestBlockhash,
  } =
    await connection.getLatestBlockhashAndContext(
      "confirmed"
    );

  /*
   * Force the transaction onto the same
   * devnet connection StockForge verified.
   */
  transaction.feePayer =
    walletPublicKey;

  transaction.recentBlockhash =
    latestBlockhash.blockhash;

  /*
   * Meteora's newly-created account must
   * sign before Phantom signs as payer.
   *
   * Config TX  -> configKeypair
   * Pool TX    -> baseMintKeypair
   */
  transaction.partialSign(
    additionalSigner
  );

  /*
   * Phantom signs only.
   * Phantom does NOT broadcast.
   */
  const signedTransaction =
    await signTransaction(
      transaction
    );

  let signature: string;

  try {
    /*
     * StockForge broadcasts through the
     * exact verified devnet RPC.
     *
     * skipPreflight=false is intentional:
     * if Meteora rejects our config, we
     * want the real simulation error now.
     */
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

  /*
   * Confirm against the EXACT blockhash
   * lifetime used for this transaction.
   */
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

export async function deployStockForgeMarket({
  connection,
  walletPublicKey,
  signTransaction,
  calibrated,
  metadataUri,
  name =
    "StockForge TSLA Demo",
  symbol =
    "TSLA-SF",
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

  const client =
    DynamicBondingCurveClient.create(
      connection,
      "confirmed"
    );

  /*
   * These two new accounts need
   * independent signatures.
   *
   * configKeypair:
   * owns the new Meteora PoolConfig account.
   *
   * baseMintKeypair:
   * becomes the new StockForge token mint.
   */
  const configKeypair =
    Keypair.generate();

  const baseMintKeypair =
    Keypair.generate();

  /*
   * ----------------------------------------
   * TRANSACTION 1
   * Create Meteora DBC config
   * ----------------------------------------
   */

  onPhase?.(
    "creating-config"
  );

  const createConfigTx =
    await client.partner.createConfig({
      config:
        configKeypair.publicKey,

      /*
       * StockForge self-launch model:
       * connected wallet is partner
       * authority and fee receiver.
       */
      feeClaimer:
        walletPublicKey,

      /*
       * 797 leftover tokens in our
       * current calibrated example will
       * eventually be withdrawable here
       * after migration.
       */
      leftoverReceiver:
        walletPublicKey,

      payer:
        walletPublicKey,

      quoteMint:
        DEVNET_USDC_MINT,

      /*
       * This contains:
       *
       * - sqrt start price
       * - custom curve points
       * - 58 bps fee
       * - migration threshold
       * - token supply
       * - leftover
       * - DAMM v2 migration settings
       */
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
  });

  await waitForAccount(
    connection,
    configKeypair.publicKey
  );

  /*
   * ----------------------------------------
   * TRANSACTION 2
   * Create token + DBC pool
   * ----------------------------------------
   */

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
  });

  /*
   * Meteora derives the active DBC pool
   * from:
   *
   * quote mint
   * +
   * base mint
   * +
   * config
   */
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
    };

  /*
   * Temporary persistence until we add
   * the proper StockForge market registry.
   */
  window.localStorage.setItem(
    "stockforge:last-deployment",
    JSON.stringify(result)
  );

  onPhase?.(
    "complete"
  );

  return result;
}