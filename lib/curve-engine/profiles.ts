import type {
  RiskProfile,
} from "./types";

export type CurveProfileConfig = {
  fairValueBaseWidth: number;
  fairValueVolatilityFactor: number;

  discoveryBaseWidth: number;
  discoveryVolatilityFactor: number;

  expansionBaseWidth: number;
  expansionVolatilityFactor: number;

  initialPositionInsideDiscovery: number;

  liquidityWeights: {
    discovery: number;
    fairValue: number;
    expansion: number;
  };

  feeAdjustmentBps: number;
};

export const CURVE_PROFILES: Record<
  RiskProfile,
  CurveProfileConfig
> = {
  conservative: {
    /*
     * Tighter market around reference value.
     * Most liquidity sits around fair value.
     */
    fairValueBaseWidth: 0.025,
    fairValueVolatilityFactor: 0.1,

    discoveryBaseWidth: 0.015,
    discoveryVolatilityFactor: 0.04,

    expansionBaseWidth: 0.03,
    expansionVolatilityFactor: 0.05,

    initialPositionInsideDiscovery: 0.6,

    liquidityWeights: {
      discovery: 0.15,
      fairValue: 0.7,
      expansion: 0.15,
    },

    feeAdjustmentBps: 10,
  },

  balanced: {
    /*
     * Default StockForge market profile.
     */
    fairValueBaseWidth: 0.035,
    fairValueVolatilityFactor: 0.13,

    discoveryBaseWidth: 0.025,
    discoveryVolatilityFactor: 0.06,

    expansionBaseWidth: 0.05,
    expansionVolatilityFactor: 0.08,

    initialPositionInsideDiscovery: 0.4,

    liquidityWeights: {
      discovery: 0.22,
      fairValue: 0.58,
      expansion: 0.2,
    },

    feeAdjustmentBps: 0,
  },

  aggressive: {
    /*
     * Allows significantly wider price discovery.
     */
    fairValueBaseWidth: 0.05,
    fairValueVolatilityFactor: 0.16,

    discoveryBaseWidth: 0.04,
    discoveryVolatilityFactor: 0.09,

    expansionBaseWidth: 0.08,
    expansionVolatilityFactor: 0.12,

    initialPositionInsideDiscovery: 0.25,

    liquidityWeights: {
      discovery: 0.3,
      fairValue: 0.45,
      expansion: 0.25,
    },

    feeAdjustmentBps: -10,
  },
};