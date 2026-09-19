export type PythEquityFeed = {
  id: number;
  symbol: string;
  ticker: string;
  name: string;
};

export const PYTH_EQUITY_FEEDS = {
  TSLA: {
    id: 1435,
    symbol: "Equity.US.TSLA/USD",
    ticker: "TSLA",
    name: "Tesla, Inc.",
  },

  QQQ: {
    id: 1363,
    symbol: "Equity.US.QQQ/USD",
    ticker: "QQQ",
    name: "Invesco QQQ Trust Series 1",
  },

  VOO: {
    id: 1472,
    symbol: "Equity.US.VOO/USD",
    ticker: "VOO",
    name: "Vanguard S&P 500 ETF",
  },
} as const satisfies Record<
  string,
  PythEquityFeed
>;

export type PythEquityTicker =
  keyof typeof PYTH_EQUITY_FEEDS;

export const PYTH_EQUITY_TICKERS =
  Object.keys(
    PYTH_EQUITY_FEEDS
  ) as PythEquityTicker[];

export function isPythEquityTicker(
  value: string
): value is PythEquityTicker {
  return value in PYTH_EQUITY_FEEDS;
}
