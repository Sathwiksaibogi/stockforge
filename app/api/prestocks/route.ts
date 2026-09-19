import {
  Connection,
  PublicKey,
  clusterApiUrl,
} from "@solana/web3.js";

import {
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  getExtensionTypes,
  getMint,
  getTokenMetadata,
} from "@solana/spl-token";

import {
  PRESTOCKS_ASSETS,
  type PreStocksAsset,
} from "@/lib/prestocks/assets";

export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

const MAINNET_RPC_ENDPOINT =
  process.env
    .PRESTOCKS_MAINNET_RPC_URL
    ?.trim() ||
  clusterApiUrl(
    "mainnet-beta"
  );

function formatRawAmount(
  raw: bigint,
  decimals: number
) {
  const digits =
    raw.toString();

  if (decimals === 0) {
    return digits;
  }

  const padded =
    digits.padStart(
      decimals + 1,
      "0"
    );

  const integerPart =
    padded.slice(
      0,
      -decimals
    );

  const fractionalPart =
    padded
      .slice(-decimals)
      .replace(
        /0+$/,
        ""
      );

  return fractionalPart
    ? `${integerPart}.${fractionalPart}`
    : integerPart;
}

function extensionName(
  extension:
    ExtensionType
) {
  const value =
    ExtensionType[
      extension
    ];

  return typeof value ===
    "string"
    ? value
    : `Extension-${extension}`;
}

async function fetchPreStocksAsset(
  connection: Connection,
  asset: PreStocksAsset
) {
  const mintAddress =
    new PublicKey(
      asset.mint
    );

  /*
   * Passing TOKEN_2022_PROGRAM_ID makes
   * getMint validate that the account is
   * really owned by Token-2022.
   */
  const mint =
    await getMint(
      connection,
      mintAddress,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );

  const metadata =
    await getTokenMetadata(
      connection,
      mintAddress,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    ).catch(
      () => null
    );

  const extensions =
    getExtensionTypes(
      mint.tlvData
    ).map(
      extensionName
    );

  return {
    status:
      "ok" as const,

    ticker:
      asset.ticker,

    company:
      asset.company,

    category:
      asset.category,

    productUrl:
      asset.productUrl,

    mint:
      asset.mint,

    cluster:
      "mainnet-beta" as const,

    tokenProgram:
      "Token-2022" as const,

    tokenProgramAddress:
      TOKEN_2022_PROGRAM_ID
        .toBase58(),

    decimals:
      mint.decimals,

    supplyRaw:
      mint.supply
        .toString(),

    supplyUi:
      formatRawAmount(
        mint.supply,
        mint.decimals
      ),

    mintAuthority:
      mint.mintAuthority
        ?.toBase58() ??
      null,

    freezeAuthority:
      mint.freezeAuthority
        ?.toBase58() ??
      null,

    extensions,

    metadata: {
      name:
        metadata?.name ??
        asset.name,

      symbol:
        metadata?.symbol ??
        asset.ticker,

      uri:
        metadata?.uri ??
        null,
    },
  };
}

export async function GET() {
  const connection =
    new Connection(
      MAINNET_RPC_ENDPOINT,
      "confirmed"
    );

  const settled =
    await Promise.allSettled(
      PRESTOCKS_ASSETS.map(
        (asset) =>
          fetchPreStocksAsset(
            connection,
            asset
          )
      )
    );

  const assets =
    settled.map(
      (result, index) => {
        if (
          result.status ===
          "fulfilled"
        ) {
          return result.value;
        }

        const asset =
          PRESTOCKS_ASSETS[
            index
          ];

        return {
          status:
            "error" as const,

          ticker:
            asset.ticker,

          company:
            asset.company,

          category:
            asset.category,

          productUrl:
            asset.productUrl,

          mint:
            asset.mint,

          cluster:
            "mainnet-beta" as const,

          error:
            result.reason instanceof
            Error
              ? result.reason.message
              : "Unable to read this PreStocks mint from Solana mainnet.",
        };
      }
    );

  const successful =
    assets.filter(
      (asset) =>
        asset.status ===
        "ok"
    ).length;

  return Response.json(
    {
      source:
        "PreStocks Token-2022 assets on Solana",

      cluster:
        "mainnet-beta",

      mode:
        "read-only",

      fetchedAt:
        new Date()
          .toISOString(),

      status:
        successful ===
        assets.length
          ? "ok"
          : successful > 0
            ? "partial"
            : "unavailable",

      assets,
    },
    {
      headers: {
        "Cache-Control":
          "public, s-maxage=30, stale-while-revalidate=60",
      },
    }
  );
}
