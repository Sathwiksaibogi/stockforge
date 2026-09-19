"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  PythReferencePrice,
} from "@/lib/pyth/types";

type UsePythPriceResult = {
  data: PythReferencePrice | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

type PriceSnapshot = {
  ticker: string;
  value: PythReferencePrice;
};

type PriceError = {
  ticker: string;
  value: string;
};

export function usePythPrice(
  ticker: string,
  refreshIntervalMs = 10_000
): UsePythPriceResult {
  const [snapshot, setSnapshot] =
    useState<PriceSnapshot | null>(
      null
    );

  const [requestError, setRequestError] =
    useState<PriceError | null>(
      null
    );

  const requestSequence =
    useRef(0);

  const latestTickerWithData =
    useRef<string | null>(null);

  const fetchPrice =
    useCallback(async () => {
      const requestId =
        ++requestSequence.current;

      try {
        const response =
          await fetch(
            `/api/pyth/latest?ticker=${encodeURIComponent(
              ticker
            )}`,
            {
              cache: "no-store",
            }
          );

        const json =
          await response.json();

        if (!response.ok) {
          throw new Error(
            json.error ||
              "Failed to load Pyth market data."
          );
        }

        if (
          requestId !==
          requestSequence.current
        ) {
          return;
        }

        latestTickerWithData.current =
          ticker;

        setSnapshot({
          ticker,
          value:
            json as PythReferencePrice,
        });

        setRequestError(null);
      } catch (err) {
        if (
          requestId !==
          requestSequence.current
        ) {
          return;
        }

        /*
         * If we already have valid data for this ticker,
         * keep it visible when a background refresh fails.
         * A temporary network/API hiccup should not make the
         * whole Create page disappear or flash an error.
         */
        if (
          latestTickerWithData.current ===
          ticker
        ) {
          return;
        }

        setRequestError({
          ticker,
          value:
            err instanceof Error
              ? err.message
              : "Unknown market-data error.",
        });
      }
    }, [ticker]);

  useEffect(() => {
    /*
     * Invalidate an in-flight request from the previous
     * ticker before starting this ticker's request.
     */
    requestSequence.current += 1;

    const initialRequest =
      window.setTimeout(() => {
        void fetchPrice();
      }, 0);

    const interval =
      window.setInterval(() => {
        /*
         * Background refresh only.
         * We intentionally do NOT toggle a loading state here,
         * so the page stays rendered while Pyth updates.
         */
        void fetchPrice();
      }, refreshIntervalMs);

    return () => {
      window.clearTimeout(
        initialRequest
      );

      window.clearInterval(
        interval
      );
    };
  }, [
    fetchPrice,
    refreshIntervalMs,
  ]);

  const data =
    snapshot?.ticker === ticker
      ? snapshot.value
      : null;

  const error =
    requestError?.ticker === ticker
      ? requestError.value
      : null;

  /*
   * Changing assets immediately reports loading=true because
   * the previous ticker's snapshot is intentionally ignored.
   * Once this ticker either succeeds or fails, loading ends.
   */
  const loading =
    data === null &&
    error === null;

  return {
    data,
    loading,
    error,
    refresh: fetchPrice,
  };
}
