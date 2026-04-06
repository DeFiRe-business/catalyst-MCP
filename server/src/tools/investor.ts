import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getProposalById,
  getPositionsForWallet,
  addFunding,
  withdrawFromPosition,
} from "../data-store.js";

const CONNECTED_WALLET = process.env.WALLET_ADDRESS ?? "default";

export function registerInvestorTools(server: McpServer): void {
  // --- fund_proposal ---
  server.tool(
    "fund_proposal",
    "Fund a startup proposal (add liquidity to Pool 1) or back a trading agent (deposit capital to escrow). Returns transaction hash.",
    {
      proposal_id: z.string().describe("Proposal ID"),
      amount: z.number().describe("Amount in USDx to invest"),
      token: z
        .enum(["USDC", "USDT", "DAI"])
        .default("USDC")
        .describe("Stablecoin to use"),
    },
    async ({ proposal_id, amount, token }) => {
      const proposal = getProposalById(proposal_id);
      if (!proposal) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: "Proposal not found", proposal_id }),
            },
          ],
          isError: true,
        };
      }

      if (proposal.status !== "funding") {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "Proposal is not in funding phase",
                proposal_id,
                current_status: proposal.status,
              }),
            },
          ],
          isError: true,
        };
      }

      if (amount <= 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: "Amount must be positive" }),
            },
          ],
          isError: true,
        };
      }

      const result = addFunding(proposal_id, amount, CONNECTED_WALLET);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: result.success,
                proposal_id,
                amount,
                token,
                tx_hash: result.tx_hash,
                message: `Successfully funded ${proposal.name} with ${amount} ${token}`,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // --- get_my_positions ---
  server.tool(
    "get_my_positions",
    "Get all investment positions for the connected wallet across both tracks.",
    {
      track: z
        .enum(["startup", "trading", "all"])
        .default("all")
        .describe("Filter by track"),
    },
    async ({ track }) => {
      let positions = getPositionsForWallet(CONNECTED_WALLET);

      if (track !== "all") {
        positions = positions.filter((p) => p.track === track);
      }

      const totalInvested = positions.reduce(
        (s, p) => s + p.amount_invested,
        0,
      );
      const totalValue = positions.reduce((s, p) => s + p.current_value, 0);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                wallet: CONNECTED_WALLET,
                positions,
                summary: {
                  total_positions: positions.length,
                  total_invested: totalInvested,
                  total_current_value: totalValue,
                  total_pnl: Math.round((totalValue - totalInvested) * 100) / 100,
                  total_pnl_pct:
                    totalInvested > 0
                      ? `${(((totalValue - totalInvested) / totalInvested) * 100).toFixed(2)}%`
                      : "0%",
                },
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // --- withdraw_liquidity ---
  server.tool(
    "withdraw_liquidity",
    "Withdraw liquidity from a position. WARNING: If before commitment deadline, investor loses token allocation and claim rights. Tokens are redistributed to remaining investors.",
    {
      proposal_id: z.string().describe("Proposal ID"),
      amount: z
        .number()
        .default(0)
        .describe("Amount to withdraw. Use 0 for full withdrawal."),
      confirm_early_exit: z
        .boolean()
        .default(false)
        .describe("Must be true if withdrawing before commitment deadline"),
    },
    async ({ proposal_id, amount, confirm_early_exit }) => {
      const result = withdrawFromPosition(
        proposal_id,
        amount,
        CONNECTED_WALLET,
      );

      if (!result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "Position not found or nothing to withdraw",
                proposal_id,
              }),
            },
          ],
          isError: true,
        };
      }

      if (result.early_exit && !confirm_early_exit) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "Early exit requires confirm_early_exit=true",
                proposal_id,
                warning:
                  "Withdrawing before commitment deadline will forfeit token allocation and claim rights. Set confirm_early_exit=true to proceed.",
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
            text: JSON.stringify(
              {
                success: true,
                proposal_id,
                withdrawn: result.withdrawn,
                early_exit: result.early_exit,
                penalty_applied: result.penalty_applied,
                tx_hash: result.tx_hash,
                message: result.early_exit
                  ? `Withdrew ${result.withdrawn} USDx (early exit — token allocation forfeited)`
                  : `Withdrew ${result.withdrawn} USDx`,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
