import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  PYTH_EQUITY_FEEDS,
} from "@/lib/pyth/feeds";

import type {
  MarketCandle,
  MarketHistory,
} from "@/lib/market/history";

import {
  calculateAnnualizedVolatility,
} from "@/lib/market/volatility";

const PYTH_HISTORY_BASE_URL =
  "https://pyth.dourolabs.app/v1";

const CHANNEL =
  "fixed_rate@200ms";

type RawHistoryResponse = {
  s: string;

  t?: number[];
  o?: number[];
  h?: number[];
  l?: number[];
  c?: number[];
  v?: number[];

  errmsg?: string;
};

export async function GET(
  request: NextRequest
) {
  try {
    const apiKey =
      process.env.PYTH_PRO_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "PYTH_PRO_API_KEY is not configured.",
        },
        {
          status: 500,
        }
      );
    }

    const requestedTicker =
      request.nextUrl.searchParams
        .get("ticker")
        ?.toUpperCase() || "TSLA";

    const requestedDays = Number(
      request.nextUrl.searchParams.get(
        "days"
      ) || 30
    );

    /*
     * Keep requests bounded during the
     * hackathon.
     */
    const days = Math.min(
      Math.max(
        Number.isFinite(requestedDays)
          ? requestedDays
          : 30,
        7
      ),
      90
    );

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

    const nowSeconds = Math.floor(
      Date.now() / 1000
    );

    /*
     * Ask for a little more calendar history
     * than the requested observation window
     * because equities do not trade every day.
     */
    const lookbackSeconds =
      days * 1.6 * 24 * 60 * 60;

    const fromSeconds = Math.floor(
      nowSeconds - lookbackSeconds
    );

    const url = new URL(
      `${PYTH_HISTORY_BASE_URL}/${CHANNEL}/history`
    );

    url.searchParams.set(
      "symbol",
      feed.symbol
    );

    url.searchParams.set(
      "from",
      String(fromSeconds)
    );

    url.searchParams.set(
      "to",
      String(nowSeconds)
    );

    url.searchParams.set(
      "resolution",
      "D"
    );

    const response = await fetch(
      url.toString(),
      {
        method: "GET",

        headers: {
          Authorization:
            `Bearer ${apiKey}`,
        },

        cache: "no-store",
      }
    );

    if (!response.ok) {
      const errorText =
        await response.text();

      console.error(
        "Pyth History request failed:",
        response.status,
        errorText
      );

      return NextResponse.json(
        {
          error:
            "Pyth historical market-data request failed.",

          status: response.status,
        },
        {
          status: response.status,
        }
      );
    }

    const raw =
      (await response.json()) as
        RawHistoryResponse;

    if (
      raw.s !== "ok" ||
      !raw.t ||
      !raw.o ||
      !raw.h ||
      !raw.l ||
      !raw.c
    ) {
      return NextResponse.json(
        {
          error:
            raw.errmsg ||
            "Pyth returned no historical data.",
        },
        {
          status: 502,
        }
      );
    }

    const length = Math.min(
      raw.t.length,
      raw.o.length,
      raw.h.length,
      raw.l.length,
      raw.c.length
    );

    const candles: MarketCandle[] = [];

    for (
      let index = 0;
      index < length;
      index++
    ) {
      const candle: MarketCandle = {
        timestamp:
          raw.t[index],

        open:
          Number(raw.o[index]),

        high:
          Number(raw.h[index]),

        low:
          Number(raw.l[index]),

        close:
          Number(raw.c[index]),

        volume:
          raw.v?.[index] !== undefined
            ? Number(raw.v[index])
            : null,
      };

      const isValid =
        Number.isFinite(
          candle.timestamp
        ) &&
        Number.isFinite(candle.open) &&
        Number.isFinite(candle.high) &&
        Number.isFinite(candle.low) &&
        Number.isFinite(candle.close) &&
        candle.close > 0;

      if (isValid) {
        candles.push(candle);
      }
    }

    /*
     * Only use the latest requested number of
     * daily observations.
     */
    const selectedCandles =
      candles.slice(-days);

    if (selectedCandles.length < 3) {
      return NextResponse.json(
        {
          error:
            "Not enough historical observations returned by Pyth.",
        },
        {
          status: 502,
        }
      );
    }

    const closes =
      selectedCandles.map(
        (candle) => candle.close
      );

    const volatility =
      calculateAnnualizedVolatility(
        closes
      );

    const result: MarketHistory = {
      ticker: feed.ticker,

      symbol: feed.symbol,

      resolution: "1D",

      daysRequested: days,

      candles: selectedCandles,

      volatility,
    };

    return NextResponse.json(
      result,
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Pyth History API error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unexpected historical market-data error.",
      },
      {
        status: 500,
      }
    );
  }
}