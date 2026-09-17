import { NextRequest, NextResponse } from "next/server";

import { PYTH_EQUITY_FEEDS } from "@/lib/pyth/feeds";
import type { PythReferencePrice } from "@/lib/pyth/types";

const PYTH_REST_URL =
  "https://pyth-lazer.dourolabs.app/v1/latest_price";

type RawPythPriceFeed = {
  priceFeedId: number;

  price?: string | number;

  exponent?: number;

  confidence?: string | number;

  publisherCount?: number;

  marketSession?: string;

  feedUpdateTimestamp?: string | number;
};

type RawPythResponse = {
  parsed?: {
    timestampUs?: string | number;

    priceFeeds?: RawPythPriceFeed[];
  };
};

function convertFixedPoint(
  value: string | number,
  exponent: number
): number {
  return Number(value) * 10 ** exponent;
}

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.PYTH_PRO_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "PYTH_PRO_API_KEY is not configured on the server.",
        },
        {
          status: 500,
        }
      );
    }

    const requestedTicker =
      request.nextUrl.searchParams.get("ticker")?.toUpperCase() ||
      "TSLA";

    const feed =
      PYTH_EQUITY_FEEDS[
        requestedTicker as keyof typeof PYTH_EQUITY_FEEDS
      ];

    if (!feed) {
      return NextResponse.json(
        {
          error: `Unsupported ticker: ${requestedTicker}`,
        },
        {
          status: 400,
        }
      );
    }

    const response = await fetch(PYTH_REST_URL, {
      method: "POST",

      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        priceFeedIds: [feed.id],

        properties: [
          "price",
          "exponent",
          "confidence",
          "publisherCount",
          "marketSession",
          "feedUpdateTimestamp",
        ],

        formats: ["solana"],

        channel: "fixed_rate@200ms",

        ignoreInvalidFeeds: true,
      }),

      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        "Pyth Pro request failed:",
        response.status,
        errorText
      );

      const isEntitlementError = response.status === 403;

return NextResponse.json(
        {
            error: isEntitlementError
            ? "This Pyth API key is not entitled to the requested market-data feed."
            : "Pyth Pro request failed.",

            code: isEntitlementError
            ? "PYTH_FEED_NOT_ENTITLED"
            : "PYTH_REQUEST_FAILED",

            feed: feed.symbol,

            status: response.status,
        },
        {
            status: response.status,
        }
        );
    }

    const raw =
      (await response.json()) as RawPythResponse;

    const priceFeed = raw.parsed?.priceFeeds?.[0];

    if (
      !priceFeed ||
      priceFeed.price === undefined ||
      priceFeed.exponent === undefined
    ) {
      return NextResponse.json(
        {
          error: "Pyth returned no usable price.",
        },
        {
          status: 502,
        }
      );
    }

    const price = convertFixedPoint(
      priceFeed.price,
      priceFeed.exponent
    );

    const confidence =
      priceFeed.confidence !== undefined
        ? convertFixedPoint(
            priceFeed.confidence,
            priceFeed.exponent
          )
        : null;

    const feedUpdateTimestamp =
      priceFeed.feedUpdateTimestamp !== undefined
        ? Number(priceFeed.feedUpdateTimestamp)
        : null;

    const serverTimestamp =
      raw.parsed?.timestampUs !== undefined
        ? Number(raw.parsed.timestampUs)
        : null;

    /*
     * Pyth timestamps are microseconds.
     *
     * A price may be carried forward while a market is closed,
     * so feedUpdateTimestamp is more meaningful than simply
     * assuming every response contains a newly generated price.
     */
    const staleThresholdMicroseconds =
      5 * 60 * 1_000_000;

    const isStale =
      feedUpdateTimestamp !== null &&
      serverTimestamp !== null
        ? serverTimestamp - feedUpdateTimestamp >
          staleThresholdMicroseconds
        : false;

    const normalized: PythReferencePrice = {
      feedId: feed.id,

      symbol: feed.symbol,

      ticker: feed.ticker,

      name: feed.name,

      price,

      confidence,

      publisherCount:
        priceFeed.publisherCount ?? null,

      exponent: priceFeed.exponent,

      marketSession:
        priceFeed.marketSession ?? null,

      feedUpdateTimestamp,

      serverTimestamp,

      isStale,
    };

    return NextResponse.json(normalized, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Pyth API error:", error);

    return NextResponse.json(
      {
        error: "Unexpected Pyth integration error.",
      },
      {
        status: 500,
      }
    );
  }
}