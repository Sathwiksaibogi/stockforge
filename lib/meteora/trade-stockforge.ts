import type {
  WalletContextState,
} from "@solana/wallet-adapter-react";

import {
  ActivationType,
  DynamicBondingCurveClient,
  getCurrentPoint,
  SwapMode,
} from "@meteora-ag/dynamic-bonding-curve-sdk";

import BN from "bn.js";
import Decimal from "decimal.js";

import {
  Connection,
  PublicKey,
  SendTransactionError,
  Transaction,
} from "@solana/web3.js";

/*
 * Kept for backward compatibility with
 * older StockForge imports. New market
 * code passes a pool address explicitly.
 */
export const STOCKFORGE_DEMO_POOL =
  new PublicKey(
    "9HTtUh7LbwwteNrx3ApESmhbQdoxiswgjCCD9Te4nBei"
  );

const TOKEN_DECIMALS = 6;

type WalletSignTransaction =
  NonNullable<
    WalletContextState["signTransaction"]
  >;

export type StockForgeBuyQuote = {
  pool: string;

  config: string;

  baseMint: string;

  quoteMint: string;

  amountInRaw: string;

  amountInUi: string;

  outputAmountRaw: string;

  outputAmountUi: string;

  minimumAmountOutRaw: string;

  minimumAmountOutUi: string;

  tradingFeeRaw: string;

  protocolFeeRaw: string;

  referralFeeRaw: string;

  nextSqrtPrice: string;

  currentPoint: string;

  slippageBps: number;
};

type InternalQuote = {
  client:
    ReturnType<
      typeof DynamicBondingCurveClient.create
    >;

  poolAddress: PublicKey;

  amountIn: BN;

  minimumAmountOut: BN;

  display:
    StockForgeBuyQuote;
};

function validateSlippage(
  slippageBps: number
) {
  if (
    !Number.isInteger(
      slippageBps
    ) ||
    slippageBps < 0 ||
    slippageBps > 10_000
  ) {
    throw new Error(
      "Invalid slippage basis points."
    );
  }
}

function uiAmountToRaw(
  value: string,
  decimals: number
) {
  const amount =
    new Decimal(value);

  if (
    !amount.isFinite() ||
    amount.lte(0)
  ) {
    throw new Error(
      "Enter a valid positive USDC amount."
    );
  }

  const multiplier =
    new Decimal(10).pow(
      decimals
    );

  const raw =
    amount.mul(multiplier);

  if (!raw.isInteger()) {
    throw new Error(
      `USDC supports at most ${decimals} decimal places.`
    );
  }

  if (
    raw.gt(
      "18446744073709551615"
    )
  ) {
    throw new Error(
      "Trade amount is too large."
    );
  }

  return new BN(
    raw.toFixed(0)
  );
}

function rawAmountToUi(
  value: BN,
  decimals: number
) {
  return new Decimal(
    value.toString()
  )
    .div(
      new Decimal(10).pow(
        decimals
      )
    )
    .toDecimalPlaces(
      decimals
    )
    .toString();
}

function requireBnField(
  value: unknown,
  field: string
) {
  if (
    typeof value !==
      "object" ||
    value === null
  ) {
    throw new Error(
      "Invalid Meteora quote result."
    );
  }

  const fieldValue =
    (
      value as Record<
        string,
        unknown
      >
    )[field];

  if (
    BN.isBN(
      fieldValue
    )
  ) {
    return fieldValue;
  }

  if (
    typeof fieldValue ===
      "string" &&
    /^\d+$/.test(
      fieldValue
    )
  ) {
    return new BN(
      fieldValue
    );
  }

  throw new Error(
    `Meteora quote did not return ${field}.`
  );
}

function optionalBnField(
  value: unknown,
  field: string
) {
  if (
    typeof value !==
      "object" ||
    value === null
  ) {
    return new BN(0);
  }

  const fieldValue =
    (
      value as Record<
        string,
        unknown
      >
    )[field];

  if (
    BN.isBN(
      fieldValue
    )
  ) {
    return fieldValue;
  }

  if (
    typeof fieldValue ===
      "string" &&
    /^\d+$/.test(
      fieldValue
    )
  ) {
    return new BN(
      fieldValue
    );
  }

  return new BN(0);
}

function normalizePoolAddress(
  poolAddress:
    | string
    | PublicKey
) {
  return poolAddress instanceof
    PublicKey
    ? poolAddress
    : new PublicKey(
        poolAddress
      );
}

async function prepareStockForgeBuyQuote({
  connection,
  poolAddress,
  amountUsdc,
  slippageBps,
}: {
  connection: Connection;

  poolAddress:
    | string
    | PublicKey;

  amountUsdc: string;

  slippageBps: number;
}): Promise<InternalQuote> {
  validateSlippage(
    slippageBps
  );

  const selectedPool =
    normalizePoolAddress(
      poolAddress
    );

  const client =
    DynamicBondingCurveClient.create(
      connection,
      "confirmed"
    );

  const virtualPool =
    await client.state.getPool(
      selectedPool
    );

  if (!virtualPool) {
    throw new Error(
      "Selected StockForge Meteora DBC pool was not found."
    );
  }

  if (
    virtualPool
      .poolState
      .isMigrated !== 0
  ) {
    throw new Error(
      "This DBC pool has already migrated."
    );
  }

  const configAddress =
    virtualPool.poolState.config;

  const config =
    await client.state
      .getPoolConfig(
        configAddress
      );

  if (!config) {
    throw new Error(
      "Selected StockForge Meteora DBC config was not found."
    );
  }

  const activationType =
    config.activationType as ActivationType;

  const currentPoint =
    await getCurrentPoint(
      connection,
      activationType
    );

  const amountIn =
    uiAmountToRaw(
      amountUsdc,
      TOKEN_DECIMALS
    );

  const eligibleForFirstSwapWithMinFee =
    config
      .enableFirstSwapWithMinFee ===
      1 &&
    virtualPool
      .poolState
      .hasSwap === 0;

  /*
   * USDC -> selected StockForge asset.
   *
   * quote token enters,
   * base token leaves.
   */
  const quote =
    client.pool.swapQuote2({
      virtualPool,

      config,

      swapBaseForQuote:
        false,

      hasReferral:
        false,

      eligibleForFirstSwapWithMinFee,

      currentPoint,

      slippageBps,

      swapMode:
        SwapMode.ExactIn,

      amountIn,
    });

  const outputAmount =
    requireBnField(
      quote,
      "outputAmount"
    );

  const minimumAmountOut =
    requireBnField(
      quote,
      "minimumAmountOut"
    );

  const tradingFee =
    optionalBnField(
      quote,
      "tradingFee"
    );

  const protocolFee =
    optionalBnField(
      quote,
      "protocolFee"
    );

  const referralFee =
    optionalBnField(
      quote,
      "referralFee"
    );

  const nextSqrtPrice =
    requireBnField(
      quote,
      "nextSqrtPrice"
    );

  return {
    client,

    poolAddress:
      selectedPool,

    amountIn,

    minimumAmountOut,

    display: {
      pool:
        selectedPool
          .toBase58(),

      config:
        configAddress
          .toBase58(),

      baseMint:
        virtualPool
          .poolState
          .baseMint
          .toBase58(),

      quoteMint:
        config
          .quoteMint
          .toBase58(),

      amountInRaw:
        amountIn.toString(),

      amountInUi:
        rawAmountToUi(
          amountIn,
          TOKEN_DECIMALS
        ),

      outputAmountRaw:
        outputAmount
          .toString(),

      outputAmountUi:
        rawAmountToUi(
          outputAmount,
          TOKEN_DECIMALS
        ),

      minimumAmountOutRaw:
        minimumAmountOut
          .toString(),

      minimumAmountOutUi:
        rawAmountToUi(
          minimumAmountOut,
          TOKEN_DECIMALS
        ),

      tradingFeeRaw:
        tradingFee
          .toString(),

      protocolFeeRaw:
        protocolFee
          .toString(),

      referralFeeRaw:
        referralFee
          .toString(),

      nextSqrtPrice:
        nextSqrtPrice
          .toString(),

      currentPoint:
        currentPoint
          .toString(),

      slippageBps,
    },
  };
}

export async function getStockForgeBuyQuote({
  connection,
  poolAddress =
    STOCKFORGE_DEMO_POOL,
  amountUsdc,
  slippageBps = 100,
}: {
  connection: Connection;

  poolAddress?:
    | string
    | PublicKey;

  amountUsdc: string;

  slippageBps?: number;
}) {
  const result =
    await prepareStockForgeBuyQuote({
      connection,
      poolAddress,
      amountUsdc,
      slippageBps,
    });

  return result.display;
}

async function signSendAndConfirm({
  connection,
  transaction,
  walletPublicKey,
  signTransaction,
}: {
  connection: Connection;

  transaction: Transaction;

  walletPublicKey:
    PublicKey;

  signTransaction:
    WalletSignTransaction;
}) {
  const {
    context,
    value: latestBlockhash,
  } =
    await connection
      .getLatestBlockhashAndContext(
        "confirmed"
      );

  transaction.feePayer =
    walletPublicKey;

  transaction.recentBlockhash =
    latestBlockhash.blockhash;

  const signedTransaction =
    await signTransaction(
      transaction
    );

  let signature: string;

  try {
    signature =
      await connection
        .sendRawTransaction(
          signedTransaction
            .serialize(),
          {
            skipPreflight:
              false,

            preflightCommitment:
              "confirmed",

            maxRetries:
              5,

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
          error.message,
          ...(logs ?? []),
        ].join("\n")
      );
    }

    throw error;
  }

  const confirmation =
    await connection
      .confirmTransaction(
        {
          signature,

          blockhash:
            latestBlockhash
              .blockhash,

          lastValidBlockHeight:
            latestBlockhash
              .lastValidBlockHeight,
        },

        "confirmed"
      );

  if (
    confirmation.value.err
  ) {
    throw new Error(
      `Swap failed on-chain: ${JSON.stringify(
        confirmation
          .value.err
      )}`
    );
  }

  return signature;
}

export async function executeStockForgeBuy({
  connection,
  poolAddress =
    STOCKFORGE_DEMO_POOL,
  walletPublicKey,
  signTransaction,
  amountUsdc,
  slippageBps = 100,
}: {
  connection: Connection;

  poolAddress?:
    | string
    | PublicKey;

  walletPublicKey:
    PublicKey;

  signTransaction:
    WalletSignTransaction;

  amountUsdc: string;

  slippageBps?: number;
}) {
  /*
   * Always obtain a fresh quote
   * immediately before creating
   * the transaction.
   */
  const prepared =
    await prepareStockForgeBuyQuote({
      connection,
      poolAddress,
      amountUsdc,
      slippageBps,
    });

  const transaction =
    await prepared
      .client
      .pool
      .swap2({
        owner:
          walletPublicKey,

        payer:
          walletPublicKey,

        pool:
          prepared.poolAddress,

        swapBaseForQuote:
          false,

        referralTokenAccount:
          null,

        swapMode:
          SwapMode.ExactIn,

        amountIn:
          prepared.amountIn,

        minimumAmountOut:
          prepared
            .minimumAmountOut,
      });

  const signature =
    await signSendAndConfirm({
      connection,

      transaction,

      walletPublicKey,

      signTransaction,
    });

  return {
    signature,

    quote:
      prepared.display,
  };
}
