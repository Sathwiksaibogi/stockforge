export type MarketSession =
  | "regular"
  | "preMarket"
  | "postMarket"
  | "overNight"
  | "closed"
  | string;

export type PythReferencePrice = {
  feedId: number;

  symbol: string;

  ticker: string;

  name: string;

  price: number;

  confidence: number | null;

  publisherCount: number | null;

  exponent: number;

  marketSession: MarketSession | null;

  feedUpdateTimestamp: number | null;

  serverTimestamp: number | null;

  isStale: boolean;
};