"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import type {
  MarketHistory,
} from "@/lib/market/history";

type UseMarketHistoryResult = {
  data: MarketHistory | null;

  loading: boolean;

  error: string | null;

  refresh: () => Promise<void>;
};

export function useMarketHistory(
  ticker: string,
  days = 30
): UseMarketHistoryResult {
  const [data, setData] =
    useState<MarketHistory | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const fetchHistory =
    useCallback(async () => {
      try {
        setLoading(true);

        const response =
          await fetch(
            `/api/pyth/history?ticker=${encodeURIComponent(
              ticker
            )}&days=${days}`,
            {
              cache: "no-store",
            }
          );

        const json =
          await response.json();

        if (!response.ok) {
          throw new Error(
            json.error ||
              "Failed to load market history."
          );
        }

        setData(json);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unknown historical market-data error."
        );
      } finally {
        setLoading(false);
      }
    }, [ticker, days]);

  useEffect(() => {
    const initialRequest =
      window.setTimeout(() => {
        void fetchHistory();
      }, 0);

    return () => {
      window.clearTimeout(
        initialRequest
      );
    };
  }, [fetchHistory]);

  return {
    data,
    loading,
    error,
    refresh: fetchHistory,
  };
}