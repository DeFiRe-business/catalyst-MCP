/**
 * Startup agent configuration.
 */

export const STARTUP_CONFIG = {
  buybackFrequencyMs: 86400_000, // daily
  buybackAllocationPct: 0.15,    // 15% of fees go to buyback
  minBuybackAmount: 100,         // minimum USDx per buyback
  maxSlippageBps: 100,           // 1%
};
