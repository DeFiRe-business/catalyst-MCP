/**
 * DeFiRe Catalyst Trading Agent
 *
 * Full lifecycle:
 * 1. Connect to Catalyst MCP & Uniswap v4 MCP
 * 2. Browse and evaluate proposals
 * 3. Accept a suitable proposal (deposit collateral)
 * 4. Wait for funding phase to complete
 * 5. Execute trading strategy with allocated capital
 * 6. Periodically report P&L
 * 7. At commitment deadline, close positions and settle
 *
 * Uses TWO MCP servers:
 * - Catalyst MCP: Protocol interaction (proposals, status, P&L reporting)
 * - Uniswap v4 MCP: Trading operations (swaps, pool queries)
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ArbitrageStrategy } from "./strategies/arbitrage.js";
import type {
  BaseStrategy,
  Position,
  RiskLimits,
} from "./strategies/base-strategy.js";

// ---------------------------------------------------------------------------
// Configuration (would normally be loaded from agent-config.yaml + .env)
// ---------------------------------------------------------------------------

interface AgentConfig {
  name: string;
  catalystCommand: string;
  catalystArgs: string[];
  uniswapCommand: string;
  uniswapArgs: string[];
  capitalRequired: number;
  collateralAmount: number;
  commitmentDays: number;
  minReturnBps: number;
  profitSplitInvestorBps: number;
  risk: RiskLimits;
  checkIntervalMs: number;
  pnlReportIntervalMs: number;
  minProfitThreshold: number;
}

const DEFAULT_CONFIG: AgentConfig = {
  name: "CatalystArbBot",
  catalystCommand: "node",
  catalystArgs: ["../../server/dist/index.js"],
  uniswapCommand: "node",
  uniswapArgs: ["../../server/dist/index.js"], // placeholder — replace with Uniswap MCP
  capitalRequired: 50000,
  collateralAmount: 5000,
  commitmentDays: 30,
  minReturnBps: 200,
  profitSplitInvestorBps: 7000,
  risk: {
    maxPositionSize: 0.20,
    maxTotalExposure: 0.80,
    stopLossPct: 0.05,
    maxDrawdownPct: 0.15,
  },
  checkIntervalMs: 30_000,
  pnlReportIntervalMs: 3600_000,
  minProfitThreshold: 0.002,
};

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

class TradingAgent {
  private catalystMCP!: Client;
  private uniswapMCP!: Client;
  private strategy: BaseStrategy;
  private config: AgentConfig;

  private agentId: string | null = null;
  private running = false;
  private capitalBalance = 0;
  private positions: Position[] = [];
  private lastPnlReport = 0;
  private peakBalance = 0;

  constructor(config: AgentConfig, strategy: BaseStrategy) {
    this.config = config;
    this.strategy = strategy;
    this.strategy.init(config.risk);
  }

  // -----------------------------------------------------------------------
  // 1. Connect to both MCP servers
  // -----------------------------------------------------------------------

  async connectMCPs(): Promise<void> {
    console.log("[agent] Connecting to Catalyst MCP...");
    this.catalystMCP = new Client(
      { name: this.config.name, version: "0.1.0" },
      { capabilities: {} },
    );
    const catalystTransport = new StdioClientTransport({
      command: this.config.catalystCommand,
      args: this.config.catalystArgs,
    });
    await this.catalystMCP.connect(catalystTransport);
    console.log("[agent] Catalyst MCP connected.");

    console.log("[agent] Connecting to Uniswap v4 MCP...");
    this.uniswapMCP = new Client(
      { name: `${this.config.name}-uniswap`, version: "0.1.0" },
      { capabilities: {} },
    );
    const uniswapTransport = new StdioClientTransport({
      command: this.config.uniswapCommand,
      args: this.config.uniswapArgs,
    });
    await this.uniswapMCP.connect(uniswapTransport);
    console.log("[agent] Uniswap v4 MCP connected.");
  }

  // -----------------------------------------------------------------------
  // 2–3. Browse proposals, evaluate, and register
  // -----------------------------------------------------------------------

  async findAndAcceptProposal(): Promise<boolean> {
    console.log("[agent] Browsing trading proposals...");

    const listResult = await this.callCatalyst("list_proposals", {
      track: "trading",
      status: "funding",
    });
    const proposals = (listResult.proposals ?? []) as Array<Record<string, unknown>>;
    console.log(`[agent] Found ${proposals.length} funding proposals.`);

    for (const proposal of proposals) {
      console.log(`[agent] Evaluating ${proposal.name} (${proposal.id})...`);

      const evaluation = await this.callCatalyst("evaluate_proposal", {
        proposal_id: proposal.id,
        investment_amount: this.config.capitalRequired,
      });

      if (this.meetsMinCriteria(evaluation)) {
        console.log(`[agent] Proposal ${proposal.id} meets criteria. Registering...`);

        const reg = await this.callCatalyst("register_trading_agent", {
          name: this.config.name,
          strategy_description: this.strategy.description,
          capital_required: this.config.capitalRequired,
          collateral_amount: this.config.collateralAmount,
          commitment_period_days: this.config.commitmentDays,
          min_return_bps: this.config.minReturnBps,
          profit_split_investor_bps: this.config.profitSplitInvestorBps,
        });

        this.agentId = reg.agent_id as string;
        console.log(`[agent] Registered as ${this.agentId}. Collateral locked.`);
        return true;
      }

      console.log(`[agent] Proposal ${proposal.id} does not meet criteria, skipping.`);
    }

    console.log("[agent] No suitable proposal found.");
    return false;
  }

  // -----------------------------------------------------------------------
  // 4. Wait for funding phase
  // -----------------------------------------------------------------------

  async waitForActivePhase(): Promise<void> {
    if (!this.agentId) throw new Error("Agent not registered");

    console.log("[agent] Waiting for funding phase to complete...");
    while (true) {
      const status = await this.callCatalyst("get_my_agent_status", {
        agent_id: this.agentId,
      });

      if (status.status === "active") {
        this.capitalBalance = status.capital_funded as number;
        this.peakBalance = this.capitalBalance;
        console.log(
          `[agent] Funding complete. Capital available: ${this.capitalBalance} USDx`,
        );
        return;
      }

      if (status.status === "failed") {
        throw new Error("Proposal funding failed");
      }

      console.log(
        `[agent] Still in ${String(status.status)} phase (${status.capital_funded}/${status.capital_required}). Checking again in 60s...`,
      );
      await sleep(60_000);
    }
  }

  // -----------------------------------------------------------------------
  // 5–6. Trading loop with P&L reporting
  // -----------------------------------------------------------------------

  async runTradingLoop(): Promise<void> {
    if (!this.agentId) throw new Error("Agent not registered");

    this.running = true;
    console.log("[agent] Starting trading loop...");

    while (this.running) {
      // Check drawdown limit
      if (this.isDrawdownBreached()) {
        console.log(
          `[agent] Max drawdown breached (${this.config.risk.maxDrawdownPct * 100}%). Pausing trading.`,
        );
        await this.reportPnl();
        break;
      }

      // Check if commitment period is over
      const status = await this.callCatalyst("get_my_agent_status", {
        agent_id: this.agentId,
      });
      if ((status.days_remaining as number) <= 0) {
        console.log("[agent] Commitment period ended. Exiting trading loop.");
        break;
      }

      // Scan for opportunities
      const opportunities = await this.strategy.scan(this.uniswapMCP);

      for (const opp of opportunities) {
        if (opp.expectedProfit / opp.size < this.config.minProfitThreshold) {
          continue;
        }

        // Check exposure limits
        if (!this.canTakePosition(opp.size)) {
          console.log(
            `[agent] Skipping ${opp.pool} — would exceed exposure limits.`,
          );
          continue;
        }

        console.log(
          `[agent] Executing ${opp.direction} on ${opp.pool} — expected profit: ${opp.expectedProfit.toFixed(2)} USDx`,
        );

        const result = await this.strategy.execute(opp, this.uniswapMCP);
        if (result.success) {
          this.capitalBalance += result.profit;
          this.peakBalance = Math.max(this.peakBalance, this.capitalBalance);

          this.positions.push({
            token: opp.token,
            amount: result.amountOut,
            entryPrice: result.amountIn / result.amountOut,
            currentPrice: result.amountIn / result.amountOut,
          });

          console.log(
            `[agent] Trade executed. Profit: ${result.profit.toFixed(2)} USDx. Balance: ${this.capitalBalance.toFixed(2)}`,
          );
        } else {
          console.log(`[agent] Trade failed on ${opp.pool}.`);
        }
      }

      // Close positions that the strategy says should close
      await this.checkPositionExits();

      // Report P&L periodically
      if (Date.now() - this.lastPnlReport >= this.config.pnlReportIntervalMs) {
        await this.reportPnl();
      }

      await sleep(this.config.checkIntervalMs);
    }
  }

  // -----------------------------------------------------------------------
  // 7. Close all positions and settle
  // -----------------------------------------------------------------------

  async closeAllPositions(): Promise<void> {
    console.log(`[agent] Closing ${this.positions.length} open positions...`);

    for (const pos of this.positions) {
      try {
        await this.uniswapMCP.callTool({
          name: "swap",
          arguments: {
            pool: `${pos.token}/USDC`,
            tokenIn: pos.token,
            tokenOut: "USDC",
            amountIn: pos.amount,
            slippageTolerance: 0.01,
          },
        });
        console.log(`[agent] Closed position: ${pos.amount} ${pos.token}`);
      } catch (err) {
        console.error(`[agent] Failed to close ${pos.token} position:`, err);
      }
    }

    this.positions = [];

    // Final P&L report
    await this.reportPnl();
    console.log(
      `[agent] All positions closed. Final balance: ${this.capitalBalance.toFixed(2)} USDx`,
    );
  }

  // -----------------------------------------------------------------------
  // Full lifecycle entrypoint
  // -----------------------------------------------------------------------

  async start(): Promise<void> {
    try {
      await this.connectMCPs();

      const accepted = await this.findAndAcceptProposal();
      if (!accepted) {
        console.log("[agent] Shutting down — no suitable proposal found.");
        return;
      }

      await this.waitForActivePhase();
      await this.runTradingLoop();
      await this.closeAllPositions();

      console.log("[agent] Lifecycle complete.");
    } catch (err) {
      console.error("[agent] Fatal error:", err);
    } finally {
      await this.shutdown();
    }
  }

  async shutdown(): Promise<void> {
    this.running = false;
    try { await this.catalystMCP.close(); } catch { /* already closed */ }
    try { await this.uniswapMCP.close(); } catch { /* already closed */ }
    console.log("[agent] Shutdown complete.");
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private meetsMinCriteria(evaluation: Record<string, unknown>): boolean {
    const risk = evaluation.risk_score as string;
    const collateral = parseFloat(
      (evaluation.collateral_coverage as string) ?? "0",
    );
    const breakeven = (evaluation.breakeven_days as number) ?? 999;

    // Accept low/medium risk with >=7% collateral and reasonable breakeven
    if (risk === "high") return false;
    if (collateral < 7) return false;
    if (breakeven > this.config.commitmentDays * 0.5) return false;

    return true;
  }

  private canTakePosition(size: number): boolean {
    const totalExposure =
      this.positions.reduce((s, p) => s + p.amount * p.currentPrice, 0) + size;
    if (totalExposure > this.capitalBalance * this.config.risk.maxTotalExposure) {
      return false;
    }
    if (size > this.capitalBalance * this.config.risk.maxPositionSize) {
      return false;
    }
    return true;
  }

  private isDrawdownBreached(): boolean {
    if (this.peakBalance === 0) return false;
    const drawdown = (this.peakBalance - this.capitalBalance) / this.peakBalance;
    return drawdown >= this.config.risk.maxDrawdownPct;
  }

  private async checkPositionExits(): Promise<void> {
    const remaining: Position[] = [];

    for (const pos of this.positions) {
      const close = await this.strategy.shouldClose(pos, this.uniswapMCP);
      if (close) {
        console.log(
          `[agent] Strategy says close ${pos.token} position (entry: ${pos.entryPrice}, current: ${pos.currentPrice})`,
        );
        try {
          await this.uniswapMCP.callTool({
            name: "swap",
            arguments: {
              pool: `${pos.token}/USDC`,
              tokenIn: pos.token,
              tokenOut: "USDC",
              amountIn: pos.amount,
              slippageTolerance: 0.01,
            },
          });
          const pnl = pos.amount * (pos.currentPrice - pos.entryPrice);
          this.capitalBalance += pnl;
          this.peakBalance = Math.max(this.peakBalance, this.capitalBalance);
        } catch (err) {
          console.error(`[agent] Failed to close ${pos.token}:`, err);
          remaining.push(pos);
        }
      } else {
        remaining.push(pos);
      }
    }

    this.positions = remaining;
  }

  private async reportPnl(): Promise<void> {
    if (!this.agentId) return;

    const openPositions = this.positions.map((p) => ({
      token: p.token,
      amount: p.amount,
      entry_price: p.entryPrice,
      current_price: p.currentPrice,
    }));

    const result = await this.callCatalyst("report_pnl", {
      agent_id: this.agentId,
      current_balance: Math.round(this.capitalBalance * 100) / 100,
      open_positions: openPositions,
    });

    this.lastPnlReport = Date.now();
    console.log(`[agent] P&L reported. Snapshot: ${result.snapshot_id}`);
  }

  private async callCatalyst(
    tool: string,
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const result = await this.catalystMCP.callTool({
      name: tool,
      arguments: args,
    });
    const content = result.content as Array<{ text?: string }>;
    const text = content?.[0]?.text;
    if (!text) return {};
    return JSON.parse(text);
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const strategy = new ArbitrageStrategy();
const agent = new TradingAgent(DEFAULT_CONFIG, strategy);

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n[agent] SIGINT received, shutting down...");
  await agent.shutdown();
  process.exit(0);
});

agent.start().catch((err) => {
  console.error("[agent] Unhandled error:", err);
  process.exit(1);
});
