import {
  DynamicBondingCurveClient,
} from "@meteora-ag/dynamic-bonding-curve-sdk";

import BN from "bn.js";

import {
  Connection,
  PublicKey,
} from "@solana/web3.js";

type FetchStockForgePoolParams = {
  connection: Connection;
  poolAddress: string;
};

function serializeSdkValue(
  value: unknown
): unknown {
  if (
    value === null ||
    value === undefined
  ) {
    return value;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (BN.isBN(value)) {
    return value.toString(10);
  }

  if (value instanceof PublicKey) {
    return value.toBase58();
  }

  if (value instanceof Uint8Array) {
    return Array.from(value);
  }

  if (Array.isArray(value)) {
    return value.map(
      serializeSdkValue
    );
  }

  if (typeof value === "object") {
    const result:
      Record<string, unknown> = {};

    for (
      const [key, nested]
      of Object.entries(
        value as Record<
          string,
          unknown
        >
      )
    ) {
      result[key] =
        serializeSdkValue(
          nested
        );
    }

    return result;
  }

  return String(value);
}

export async function fetchStockForgePoolState({
  connection,
  poolAddress,
}: FetchStockForgePoolParams) {
  const poolPublicKey =
    new PublicKey(
      poolAddress
    );

  const client =
    DynamicBondingCurveClient.create(
      connection,
      "confirmed"
    );

  /*
   * The pool itself is our source
   * of truth.
   */
  const virtualPool =
    await client.state.getPool(
      poolPublicKey
    );

  if (!virtualPool) {
    throw new Error(
      `Meteora DBC pool not found: ${poolAddress}`
    );
  }

  /*
   * Never accept a manually supplied
   * config address.
   *
   * Read it directly from the real
   * on-chain VirtualPool.
   */
  const configPublicKey =
    virtualPool.poolState.config;

  const poolConfig =
    await client.state.getPoolConfig(
      configPublicKey
    );

  if (!poolConfig) {
    throw new Error(
      `Meteora DBC config not found: ${configPublicKey.toBase58()}`
    );
  }

  const poolState =
    virtualPool.poolState;

  return {
    network:
      "devnet",

    fetchedAt:
      new Date().toISOString(),

    addresses: {
      pool:
        poolPublicKey.toBase58(),

      config:
        configPublicKey.toBase58(),

      baseMint:
        poolState.baseMint.toBase58(),

      quoteMint:
        poolConfig.quoteMint.toBase58(),

      creator:
        poolState.creator.toBase58(),

      baseVault:
        poolState.baseVault.toBase58(),

      quoteVault:
        poolState.quoteVault.toBase58(),
    },

    market: {
      baseReserveRaw:
        poolState.baseReserve.toString(),

      quoteReserveRaw:
        poolState.quoteReserve.toString(),

      sqrtPrice:
        poolState.sqrtPrice.toString(),

      migrationProgress:
        poolState.migrationProgress,

      isMigrated:
        poolState.isMigrated,

      hasSwap:
        poolState.hasSwap,

      activationPoint:
        poolState.activationPoint.toString(),

      finishCurveTimestamp:
        poolState.finishCurveTimestamp.toString(),
    },

    configSummary: {
      tokenDecimals:
        poolConfig.tokenDecimal,

      baseFeeNumerator:
        poolConfig.poolFees.baseFee
          .cliffFeeNumerator
          .toString(),

      migrationQuoteThresholdRaw:
        poolConfig.migrationQuoteThreshold
          .toString(),

      migrationBaseThresholdRaw:
        poolConfig.migrationBaseThreshold
          .toString(),

      preMigrationTokenSupplyRaw:
        poolConfig.preMigrationTokenSupply
          .toString(),

      postMigrationTokenSupplyRaw:
        poolConfig.postMigrationTokenSupply
          .toString(),

      creatorLiquidityPercentage:
        poolConfig.creatorLiquidityPercentage,

      creatorPermanentLockedLiquidityPercentage:
        poolConfig
          .creatorPermanentLockedLiquidityPercentage,
    },

    raw: {
      pool:
        serializeSdkValue(
          virtualPool
        ),

      config:
        serializeSdkValue(
          poolConfig
        ),
    },
  };
}