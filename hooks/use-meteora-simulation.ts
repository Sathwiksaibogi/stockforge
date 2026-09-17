"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  StockForgeSimulationResponse,
} from "@/lib/meteora/simulation-types";

type RiskProfile =
  | "conservative"
  | "balanced"
  | "aggressive";

type SimulationParams = {
  referencePrice: number;

  annualizedVolatility: number;

  targetRaiseUsd: number;

  graduationUsd: number;

  totalSupply: number;

  riskProfile: RiskProfile;

  amounts: number[];

  slippageBps?: number;
};

export function useMeteoraSimulation(
  params:
    | SimulationParams
    | null
) {
  const [
    data,
    setData,
  ] =
    useState<StockForgeSimulationResponse | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );

  const amountsKey =
    useMemo(
      () =>
        params
          ? params.amounts.join(
              ","
            )
          : "",
      [params]
    );

  const fetchSimulation =
    useCallback(async () => {
      if (!params) {
        return;
      }

      try {
        setLoading(true);

        const search =
          new URLSearchParams({
            reference:
              params.referencePrice
                .toString(),

            volatility:
              params.annualizedVolatility
                .toString(),

            targetRaise:
              params.targetRaiseUsd
                .toString(),

            graduation:
              params.graduationUsd
                .toString(),

            supply:
              params.totalSupply
                .toString(),

            risk:
              params.riskProfile,

            amounts:
              amountsKey,

            slippageBps:
              (
                params.slippageBps ??
                100
              ).toString(),
          });

        const response =
          await fetch(
            `/api/meteora/simulate?${search.toString()}`,
            {
              cache:
                "no-store",
            }
          );

        const json =
          await response.json();

        if (!response.ok) {
          throw new Error(
            json.error ||
              "Meteora simulation failed."
          );
        }

        setData(json);
        setError(null);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Unknown simulation error."
        );
      } finally {
        setLoading(false);
      }
    }, [
      params,
      amountsKey,
    ]);

  useEffect(() => {
    if (!params) {
      return;
    }

    const request =
      window.setTimeout(
        () => {
          void fetchSimulation();
        },
        0
      );

    return () => {
      window.clearTimeout(
        request
      );
    };
  }, [
    params,
    fetchSimulation,
  ]);

  return {
    data,
    loading,
    error,

    refresh:
      fetchSimulation,
  };
}