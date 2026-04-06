import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  registerTradingAgentData,
  getAgentStatus,
  recordPnlSnapshot,
  fileClaim,
  getProposalById,
} from "../data-store.js";
import type { OpenPosition } from "../types.js";

const CONNECTED_WALLET = process.env.WALLET_ADDRESS ?? "default";

export function registerTradingTools(server: McpServer): void {
  // --- register_trading_agent ---
  server.tool(
    "register_trading_agent",
    "Register as a trading agent on DeFiRe Catalyst. Deposit collateral and define strategy parameters.",
    {
      name: z.string().describe("Agent name"),
      strategy_description: z.string().describe("Strategy description"),
      capital_required: z
        .number()
        .describe("Capital needed from investors"),
      collateral_amount: z.number().describe("Collateral to deposit"),
      commitment_period_days: z.number().describe("Commitment period in days"),
      min_return_bps: z
        .number()
        .describe("Minimum guaranteed return in basis points (200 = 2%)"),
      profit_split_investor_bps: z
        .number()
        .describe("Investor's profit share in bps (7000 = 70%)"),
    },
    async (params) => {
      if (params.collateral_amount <= 0 || params.capital_required <= 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error:
                  "collateral_amount and capital_required must be positive",
              }),
            },
          ],
          isError: true,
        };
      }

      const minRatio = 0.10;
      if (params.collateral_amount / params.capital_required < minRatio) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: `Collateral ratio too low. Minimum for trading agents is ${minRatio * 100}%. Provided: ${((params.collateral_amount / params.capital_required) * 100).toFixed(2)}%`,
              }),
            },
          ],
          isError: true,
        };
      }

      if (
        params.profit_split_investor_bps < 0 ||
        params.profit_split_investor_bps > 9000
      ) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error:
                  "profit_split_investor_bps must be between 0 and 9000 (protocol takes 10%)",
              }),
            },
          ],
          isError: true,
        };
      }

      const result = registerTradingAgentData({
        ...params,
        owner: CONNECTED_WALLET,
      });

      const agentBps =
        10000 - params.profit_split_investor_bps - 1000;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                agent_id: result.agent_id,
                name: params.name,
                capital_required: params.capital_required,
                collateral_locked: params.collateral_amount,
                collateral_ratio:
                  ((params.collateral_amount / params.capital_required) * 100).toFixed(2) + "%",
                min_return_bps: params.min_return_bps,
                profit_split: {
                  investor: params.profit_split_investor_bps / 100 + "%",
                  agent: agentBps / 100 + "%",
                  protocol: "10%",
                },
                tx_hash: result.tx_hash,
                message: `Trading agent "${params.name}" registered. Collateral locked. Awaiting investor funding.`,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // --- get_my_agent_status ---
  server.tool(
    "get_my_agent_status",
    "Get trading agent status: P&L, capital available, fees received, time remaining, tier.",
    {
      agent_id: z.string().describe("Agent ID"),
    },
    async ({ agent_id }) => {
      const status = getAgentStatus(agent_id);
      if (!status) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "Trading agent not found",
                agent_id,
              }),
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(status, null, 2),
          },
        ],
      };
    },
  );

  // --- report_pnl ---
  server.tool(
    "report_pnl",
    "Submit a P&L snapshot. Updates the on-chain record and investor-visible metrics.",
    {
      agent_id: z.string().describe("Agent ID"),
      current_balance: z
        .number()
        .describe("Current total balance in USDx"),
      open_positions: z
        .array(
          z.object({
            token: z.string(),
            amount: z.number(),
            entry_price: z.number(),
            current_price: z.number(),
          }),
        )
        .optional()
        .describe("List of open positions"),
    },
    async ({ agent_id, current_balance, open_positions }) => {
      const positions: OpenPosition[] = open_positions ?? [];

      const result = recordPnlSnapshot(agent_id, current_balance, positions);
      if (!result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "Trading agent not found",
                agent_id,
              }),
            },
          ],
          isError: true,
        };
      }

      const unrealizedPnl = positions.reduce(
        (sum, p) => sum + p.amount * (p.current_price - p.entry_price),
        0,
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                agent_id,
                snapshot_id: result.snapshot_id,
                timestamp: result.timestamp,
                reported_balance: current_balance,
                open_positions_count: positions.length,
                unrealized_pnl: Math.round(unrealizedPnl * 100) / 100,
                message: `P&L snapshot recorded at ${result.timestamp}`,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // --- file_claim ---
  server.tool(
    "file_claim",
    "File a claim against collateral of a failed agent/startup via ERC-8210 AssuranceAccount.",
    {
      proposal_id: z.string().describe("Proposal ID"),
      claim_amount: z
        .number()
        .describe(
          "Amount to claim. Max = investor's pro-rata share of collateral.",
        ),
    },
    async ({ proposal_id, claim_amount }) => {
      if (claim_amount <= 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: "claim_amount must be positive" }),
            },
          ],
          isError: true,
        };
      }

      const result = fileClaim(proposal_id, claim_amount, CONNECTED_WALLET);

      if (!result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: result.message,
                proposal_id,
              }),
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );
}
