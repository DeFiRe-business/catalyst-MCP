import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getProposalById,
  getPositionsForWallet,
  addFunding,
  withdrawFromPosition,
  fileClaim,
} from "../data-store.js";
import {
  resolveProposalFromChain,
  getInvestorPosition,
} from "../blockchain/contracts.js";

const CONNECTED_WALLET = process.env.WALLET_ADDRESS ?? "default";

export function registerInvestorTools(server: McpServer): void {
  // --- fund_proposal ---
  server.tool(
    "fund_proposal",
    "Fund a startup proposal — deposit liquidity into Pool 1. Returns transaction hash.",
    {
      proposal_id: z.string().describe("Proposal ID"),
      amount: z.number().describe("Amount in USDx to invest"),
      token: z
        .enum(["USDC", "USDT", "DAI"])
        .default("USDC")
        .describe("Stablecoin to use"),
    },
    async ({ proposal_id, amount, token }) => {
      // On-chain first, data-store fallback
      const proposal =
        (await resolveProposalFromChain(proposal_id)) ??
        getProposalById(proposal_id);
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
    "Get all investment positions for the connected wallet.",
    {},
    async () => {
      const positions = getPositionsForWallet(CONNECTED_WALLET);

      // Try to enrich each position with on-chain data
      for (const pos of positions) {
        const match = pos.proposal_id.match(/^prop_(\d+)$/);
        if (!match) continue;
        const jobId = parseInt(match[1], 10);
        const chainPos = await getInvestorPosition(jobId, CONNECTED_WALLET);
        if (chainPos) {
          pos.amount_invested = Number(chainPos.amountInvested) / 1e6;
          pos.current_value = Number(chainPos.currentValue) / 1e6;
          pos.tokens_allocated = Number(chainPos.tokensAllocated) / 1e6;
          pos.pnl = pos.current_value - pos.amount_invested;
          pos.pnl_pct =
            pos.amount_invested > 0
              ? `${((pos.pnl / pos.amount_invested) * 100).toFixed(2)}%`
              : "0%";
        }
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
    "Withdraw liquidity from a startup position. WARNING: If before commitment deadline, investor loses token allocation and claim rights. Tokens are redistributed to remaining investors.",
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

  // --- file_claim ---
  server.tool(
    "file_claim",
    "File a claim against collateral of a failed startup via ERC-8210 AssuranceAccount.",
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
