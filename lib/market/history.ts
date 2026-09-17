import type {
  VolatilityMetrics,
} from "./volatility";

export type MarketCandle = {
  timestamp: number;

  open: number;
  high: number;
  low: number;
  close: number;

  volume: number | null;
};

export type MarketHistory = {
  ticker: string;

  symbol: string;

  resolution: string;

  daysRequested: number;

  candles: MarketCandle[];

  volatility: VolatilityMetrics;
};