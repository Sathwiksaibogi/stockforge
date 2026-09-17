"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import type { PythReferencePrice } from "@/lib/pyth/types";

type UsePythPriceResult = {
  data: PythReferencePrice | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function usePythPrice(
  ticker: string,
  refreshIntervalMs = 10_000
): UsePythPriceResult {
  const [data, setData] =
    useState<PythReferencePrice | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const fetchPrice = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/pyth/latest?ticker=${encodeURIComponent(
          ticker
        )}`,
        {
          cache: "no-store",
        }
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json.error ||
            "Failed to load Pyth market data."
        );
      }

      setData(json);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unknown market-data error."
      );
    } finally {
      setLoading(false);
    }
  }, [ticker]);

  useEffect(() => {
    /*
     * Schedule the initial request after the effect
     * has completed instead of synchronously
     * triggering state-changing logic inside it.
     */
    const initialRequest =
      window.setTimeout(() => {
        void fetchPrice();
      }, 0);

    const interval =
      window.setInterval(() => {
        void fetchPrice();
      }, refreshIntervalMs);

    return () => {
      window.clearTimeout(initialRequest);
      window.clearInterval(interval);
    };
  }, [fetchPrice, refreshIntervalMs]);

  return {
    data,
    loading,
    error,
    refresh: fetchPrice,
  };
}