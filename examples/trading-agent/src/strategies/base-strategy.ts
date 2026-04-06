/**
 * Base strategy interface. Implement this to create your own trading strategy.
 *
 * The strategy receives an MCP client connected to Uniswap v4.
 * Use it to query pool states, check prices, and execute swaps.
 */
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

export interface Opportunity {
  pool: string;
  direction: "buy" | "sell";
  token: string;
  expectedProfit: number;
  confidence: number;
  size: number;
}

export interface TradeResult {
  success: boolean;
  txHash?: string;
  amountIn: number;
  amountOut: number;
  profit: number;
}

export interface Position {
  token: string;
  amount: number;
  entryPrice: number;
  currentPrice: number;
}

export interface RiskLimits {
  maxPositionSize: number;
  maxTotalExposure: number;
  stopLossPct: number;
  maxDrawdownPct: number;
}

export interface BaseStrategy {
  readonly name: string;
  readonly description: string;

  /**
   * Initialize the strategy with risk parameters.
   */
  init(riskLimits: RiskLimits): void;

  /**
   * Scan the market for trading opportunities using Uniswap MCP.
   */
  scan(uniswapMCP: Client): Promise<Opportunity[]>;

  /**
   * Execute a trade for the given opportunity.
   */
  execute(opportunity: Opportunity, uniswapMCP: Client): Promise<TradeResult>;

  /**
   * Determine if an open position should be closed.
   */
  shouldClose(position: Position, uniswapMCP: Client): Promise<boolean>;
}
