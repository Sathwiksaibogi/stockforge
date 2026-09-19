import {
  PYTH_EQUITY_FEEDS,
  type PythEquityTicker,
} from "@/lib/pyth/feeds";

export type StockForgeAsset = {
  ticker: PythEquityTicker;

  referenceName: string;

  tokenName: string;

  tokenSymbol: string;

  metadataPath: string;
};

export const STOCKFORGE_ASSETS = {
  TSLA: {
    ticker: "TSLA",

    referenceName:
      PYTH_EQUITY_FEEDS.TSLA.name,

    tokenName:
      "StockForge TSLA Demo",

    tokenSymbol:
      "TSLA-SF",

    metadataPath:
      "/metadata/tsla-sf.json",
  },

  QQQ: {
    ticker: "QQQ",

    referenceName:
      PYTH_EQUITY_FEEDS.QQQ.name,

    tokenName:
      "StockForge QQQ Demo",

    tokenSymbol:
      "QQQ-SF",

    metadataPath:
      "/metadata/qqq-sf.json",
  },

  VOO: {
    ticker: "VOO",

    referenceName:
      PYTH_EQUITY_FEEDS.VOO.name,

    tokenName:
      "StockForge VOO Demo",

    tokenSymbol:
      "VOO-SF",

    metadataPath:
      "/metadata/voo-sf.json",
  },
} as const satisfies Record<
  PythEquityTicker,
  StockForgeAsset
>;

export function getStockForgeAsset(
  ticker: PythEquityTicker
) {
  return STOCKFORGE_ASSETS[
    ticker
  ];
}

function trimTrailingSlash(
  value: string
) {
  return value.replace(
    /\/+$/,
    ""
  );
}

export function getStockForgeMetadataUri(
  ticker: PythEquityTicker
) {
  const asset =
    getStockForgeAsset(
      ticker
    );

  const configuredBase =
    process.env
      .NEXT_PUBLIC_STOCKFORGE_METADATA_BASE_URL
      ?.trim();

  if (configuredBase) {
    return `${trimTrailingSlash(
      configuredBase
    )}${asset.metadataPath}`;
  }

  /*
   * Backward-compatible path for the
   * original TSLA-only environment.
   *
   * Existing project value:
   * https://.../metadata/tsla-sf.json
   *
   * From that URI we can derive the same
   * public metadata base for QQQ and VOO.
   */
  const legacyTslaUri =
    process.env
      .NEXT_PUBLIC_STOCKFORGE_METADATA_URI
      ?.trim();

  if (legacyTslaUri) {
    if (ticker === "TSLA") {
      return legacyTslaUri;
    }

    const suffix =
      "/metadata/tsla-sf.json";

    if (
      legacyTslaUri.endsWith(
        suffix
      )
    ) {
      const base =
        legacyTslaUri.slice(
          0,
          -suffix.length
        );

      return `${trimTrailingSlash(
        base
      )}${asset.metadataPath}`;
    }
  }

  throw new Error(
    [
      "StockForge metadata base URL is not configured.",
      "Set NEXT_PUBLIC_STOCKFORGE_METADATA_BASE_URL to your public HTTPS deployment origin.",
    ].join(" ")
  );
}
