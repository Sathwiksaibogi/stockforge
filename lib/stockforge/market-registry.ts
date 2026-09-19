import type {
  PythEquityTicker,
} from "@/lib/pyth/feeds";

import {
  STOCKFORGE_ASSETS,
  type StockForgeAsset,
} from "@/lib/stockforge/assets";

export const STOCKFORGE_DEPLOYMENTS_STORAGE_KEY =
  "stockforge:deployments";

export type StockForgeDeploymentRecord = {
  cluster: "devnet";

  ticker: PythEquityTicker;

  tokenName: string;

  tokenSymbol: string;

  configAddress: string;

  baseMintAddress: string;

  poolAddress: string;

  quoteMintAddress: string;

  metadataUri: string;

  configSignature?: string;

  poolSignature?: string;

  deployedAt?: number;
};

export type StockForgeMarketOption = {
  ticker: PythEquityTicker;

  asset: StockForgeAsset;

  deployment:
    | StockForgeDeploymentRecord
    | null;
};

/*
 * Confirmed StockForge Devnet markets.
 *
 * Keeping confirmed deployments here makes
 * the Market page portable across browsers.
 * Browser-local deployment records are still
 * merged below, so future markets can appear
 * immediately after deployment.
 */
export const STOCKFORGE_BUILT_IN_DEPLOYMENTS:
  Partial<
    Record<
      PythEquityTicker,
      StockForgeDeploymentRecord
    >
  > = {
    TSLA: {
      cluster: "devnet",

      ticker: "TSLA",

      tokenName:
        "StockForge TSLA Demo",

      tokenSymbol:
        "TSLA-SF",

      configAddress:
        "AXbs14xKgSP7fjZi2xmzKqhoJBJTFcCHaKFCH1i3eBJN",

      baseMintAddress:
        "DGU7bwLvz2gMfR1XQTkmF5QzeLJerzbvdze4Vb2kkpa9",

      poolAddress:
        "9HTtUh7LbwwteNrx3ApESmhbQdoxiswgjCCD9Te4nBei",

      quoteMintAddress:
        "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",

      metadataUri:
        "https://stockforge-liard.vercel.app/metadata/tsla-sf.json",
    },

    QQQ: {
      cluster: "devnet",

      ticker: "QQQ",

      tokenName:
        "StockForge QQQ Demo",

      tokenSymbol:
        "QQQ-SF",

      configAddress:
        "EdmbxXvbp2atSf4ocAZeAnGMY6hNQuZ51UtCwWekxvmm",

      baseMintAddress:
        "HthfY4R3PeCn8Hz8s2R59KPeU9RVkvx3kp3JfoZwFH7S",

      poolAddress:
        "4nWM5zVcqsKCUjtVd6dW7wmNKnTomng1vnUF7Y9DGaHZ",

      quoteMintAddress:
        "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",

      metadataUri:
        "https://stockforge-liard.vercel.app/metadata/qqq-sf.json",
    },
  };

const MARKET_ORDER:
  PythEquityTicker[] = [
    "TSLA",
    "QQQ",
    "VOO",
  ];

function isTicker(
  value: unknown
): value is PythEquityTicker {
  return (
    value === "TSLA" ||
    value === "QQQ" ||
    value === "VOO"
  );
}

function isNonEmptyString(
  value: unknown
): value is string {
  return (
    typeof value === "string" &&
    value.length > 0
  );
}

function parseDeployment(
  value: unknown
): StockForgeDeploymentRecord | null {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return null;
  }

  const candidate =
    value as Record<
      string,
      unknown
    >;

  if (
    candidate.cluster !== "devnet" ||
    !isTicker(candidate.ticker) ||
    !isNonEmptyString(
      candidate.tokenName
    ) ||
    !isNonEmptyString(
      candidate.tokenSymbol
    ) ||
    !isNonEmptyString(
      candidate.configAddress
    ) ||
    !isNonEmptyString(
      candidate.baseMintAddress
    ) ||
    !isNonEmptyString(
      candidate.poolAddress
    ) ||
    !isNonEmptyString(
      candidate.quoteMintAddress
    ) ||
    !isNonEmptyString(
      candidate.metadataUri
    )
  ) {
    return null;
  }

  return {
    cluster: "devnet",

    ticker:
      candidate.ticker,

    tokenName:
      candidate.tokenName,

    tokenSymbol:
      candidate.tokenSymbol,

    configAddress:
      candidate.configAddress,

    baseMintAddress:
      candidate.baseMintAddress,

    poolAddress:
      candidate.poolAddress,

    quoteMintAddress:
      candidate.quoteMintAddress,

    metadataUri:
      candidate.metadataUri,

    configSignature:
      isNonEmptyString(
        candidate.configSignature
      )
        ? candidate.configSignature
        : undefined,

    poolSignature:
      isNonEmptyString(
        candidate.poolSignature
      )
        ? candidate.poolSignature
        : undefined,

    deployedAt:
      typeof candidate.deployedAt ===
        "number" &&
      Number.isFinite(
        candidate.deployedAt
      )
        ? candidate.deployedAt
        : undefined,
  };
}

export function readBrowserDeployments() {
  if (
    typeof window ===
    "undefined"
  ) {
    return [] as StockForgeDeploymentRecord[];
  }

  try {
    const raw =
      window.localStorage.getItem(
        STOCKFORGE_DEPLOYMENTS_STORAGE_KEY
      );

    if (!raw) {
      return [] as StockForgeDeploymentRecord[];
    }

    const parsed =
      JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [] as StockForgeDeploymentRecord[];
    }

    return parsed
      .map(parseDeployment)
      .filter(
        (
          item
        ): item is StockForgeDeploymentRecord =>
          item !== null
      );
  } catch {
    return [] as StockForgeDeploymentRecord[];
  }
}

export function getStockForgeMarketOptions(): StockForgeMarketOption[] {
  const deployments =
    new Map<
      PythEquityTicker,
      StockForgeDeploymentRecord
    >();

  for (
    const ticker of
    MARKET_ORDER
  ) {
    const builtIn =
      STOCKFORGE_BUILT_IN_DEPLOYMENTS[
        ticker
      ];

    if (builtIn) {
      deployments.set(
        ticker,
        builtIn
      );
    }
  }

  /*
   * Browser records override the built-in
   * record for the same ticker. This keeps
   * newly-created deployments immediately
   * usable without a code change.
   */
  for (
    const deployment of
    readBrowserDeployments()
  ) {
    deployments.set(
      deployment.ticker,
      deployment
    );
  }

  return MARKET_ORDER.map(
    (ticker) => ({
      ticker,

      asset:
        STOCKFORGE_ASSETS[
          ticker
        ],

      deployment:
        deployments.get(
          ticker
        ) ?? null,
    })
  );
}
