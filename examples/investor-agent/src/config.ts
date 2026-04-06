/**
 * Investor agent configuration.
 */

export const INVESTOR_CONFIG = {
  maxPositionSize: 20000,
  maxTotalExposure: 100000,
  minCollateralRatio: 0.07,
  preferredTracks: ["startup", "trading"] as const,
  rebalanceIntervalMs: 3600_000,
};
