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
} satisfies Record<string, PythEquityFeed>;