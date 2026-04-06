/**
 * Cross-pool arbitrage strategy.
 *
 * Scans two correlated pools for price discrepancies and executes
 * simultaneous buy/sell to capture the spread. Works on Uniswap v4
 * pools via the Uniswap MCP server.
 */
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type {
  BaseStrategy,
  Opportunity,
  TradeResult,
  Position,
  RiskLimits,
} from "./base-strategy.js";

interface PoolPrice {
  pool: string;
  token: string;
  price: number;
  liquidity: number;
}

export class ArbitrageStrategy implements BaseStrategy {
  readonly name = "arbitrage";
  readonly description =
    "Cross-pool arbitrage on correlated pairs — captures price discrepancies between pools";

  private riskLimits: RiskLimits = {
    maxPositionSize: 0.2,
    maxTotalExposure: 0.8,
    stopLossPct: 0.05,
    maxDrawdownPct: 0.15,
  };

  private readonly pools = ["ETH/USDC", "WBTC/USDC"];
  private readonly minSpreadBps = 20; // 0.2% minimum spread to trade

  init(riskLimits: RiskLimits): void {
    this.riskLimits = riskLimits;
  }

  async scan(uniswapMCP: Client): Promise<Opportunity[]> {
    const opportunities: Opportunity[] = [];

    for (const pool of this.pools) {
      const prices = await this.fetchPoolPrices(uniswapMCP, pool);
      if (prices.length < 2) continue;

      // Compare prices across related pools for the same token
      for (let i = 0; i < prices.length; i++) {
        for (let j = i + 1; j < prices.length; j++) {
          const spread = this.calculateSpread(prices[i], prices[j]);
          if (spread.bps >= this.minSpreadBps) {
            const size = Math.min(
              prices[i].liquidity * 0.01,  // max 1% of pool liquidity
              this.riskLimits.maxPositionSize * 100000, // scaled by capital
            );

            opportunities.push({
              pool: `${prices[i].pool}->${prices[j].pool}`,
              direction: spread.buyFrom === i ? "buy" : "sell",
              token: prices[i].token,
              expectedProfit: size * (spread.bps / 10000),
              confidence: Math.min(0.95, spread.bps / 100), // higher spread = higher confidence
              size,
            });
          }
        }
      }
    }

    // Sort by expected profit descending
    return opportunities.sort((a, b) => b.expectedProfit - a.expectedProfit);
  }

  async execute(
    opportunity: Opportunity,
    uniswapMCP: Client,
  ): Promise<TradeResult> {
    const [poolA, poolB] = opportunity.pool.split("->");

    try {
      // Step 1: Buy on the cheaper pool
      const buyResult = await uniswapMCP.callTool({
        name: "swap",
        arguments: {
          pool: poolA,
          tokenIn: "USDC",
          tokenOut: opportunity.token,
          amountIn: opportunity.size,
          slippageTolerance: 0.005,
        },
      });

      const buyData = this.parseToolResult(buyResult);
      if (!buyData.success) {
        return {
          success: false,
          amountIn: opportunity.size,
          amountOut: 0,
          profit: 0,
        };
      }

      // Step 2: Sell on the more expensive pool
      const sellResult = await uniswapMCP.callTool({
        name: "swap",
        arguments: {
          pool: poolB,
          tokenIn: opportunity.token,
          tokenOut: "USDC",
          amountIn: buyData.amountOut,
          slippageTolerance: 0.005,
        },
      });

      const sellData = this.parseToolResult(sellResult);
      const sellAmountOut = (sellData.amountOut as number) ?? 0;
      const profit = sellAmountOut - opportunity.size;

      return {
        success: (sellData.success as boolean) && profit > 0,
        txHash: sellData.txHash as string | undefined,
        amountIn: opportunity.size,
        amountOut: sellAmountOut,
        profit,
      };
    } catch {
      return {
        success: false,
        amountIn: opportunity.size,
        amountOut: 0,
        profit: 0,
      };
    }
  }

  async shouldClose(position: Position, _uniswapMCP: Client): Promise<boolean> {
    const pnlPct =
      (position.currentPrice - position.entryPrice) / position.entryPrice;

    // Close if stop-loss hit
    if (pnlPct <= -this.riskLimits.stopLossPct) return true;

    // For arbitrage, positions are meant to be short-lived.
    // Close immediately if any profit is captured.
    if (pnlPct > 0) return true;

    return false;
  }

  // --- Private helpers ---

  private async fetchPoolPrices(
    uniswapMCP: Client,
    pool: string,
  ): Promise<PoolPrice[]> {
    try {
      const result = await uniswapMCP.callTool({
        name: "getPoolState",
        arguments: { pool },
      });

      const data = this.parseToolResult(result);
      const [tokenA] = pool.split("/");

      return [
        {
          pool,
          token: tokenA,
          price: (data.price as number) ?? 0,
          liquidity: (data.liquidity as number) ?? 0,
        },
      ];
    } catch {
      return [];
    }
  }

  private calculateSpread(
    a: PoolPrice,
    b: PoolPrice,
  ): { bps: number; buyFrom: number } {
    if (a.price === 0 || b.price === 0) return { bps: 0, buyFrom: 0 };
    const diff = Math.abs(a.price - b.price);
    const mid = (a.price + b.price) / 2;
    const bps = Math.round((diff / mid) * 10000);
    const buyFrom = a.price < b.price ? 0 : 1;
    return { bps, buyFrom };
  }

  private parseToolResult(result: unknown): Record<string, unknown> {
    try {
      const r = result as { content?: Array<{ text?: string }> };
      const text = r.content?.[0]?.text;
      if (text) return JSON.parse(text);
    } catch {
      // fall through
    }
    return {};
  }
}
