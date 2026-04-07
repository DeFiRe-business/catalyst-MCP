import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getAllProposals,
  getProposalById,
} from "../data-store.js";
import { resolveProposalFromChain } from "../blockchain/contracts.js";
import type {
  StartupProposal,
  EvaluationResult,
} from "../types.js";

export function registerMarketplaceTools(server: McpServer): void {
  // --- list_proposals ---
  server.tool(
    "list_proposals",
    "List startup proposals on DeFiRe Catalyst marketplace. Returns startups seeking funding.",
    {
      status: z
        .enum(["funding", "active", "completed", "failed", "all"])
        .default("funding")
        .describe("Filter by status"),
      sort_by: z
        .enum(["newest", "capital_desc", "collateral_ratio_desc"])
        .default("newest")
        .describe("Sort order"),
      min_capital: z
        .number()
        .optional()
        .describe("Minimum capital in USD"),
      max_capital: z
        .number()
        .optional()
        .describe("Maximum capital in USD"),
      limit: z.number().default(20).describe("Max results to return"),
    },
    async ({ status, sort_by, min_capital, max_capital, limit }) => {
      let proposals = getAllProposals();

      // Filter by status
      if (status !== "all") {
        proposals = proposals.filter((p) => p.status === status);
      }

      // Filter by capital range
      if (min_capital !== undefined) {
        proposals = proposals.filter((p) => p.capital_seeking >= min_capital);
      }
      if (max_capital !== undefined) {
        proposals = proposals.filter((p) => p.capital_seeking <= max_capital);
      }

      // Sort
      proposals = sortProposals(proposals, sort_by);

      // Limit
      proposals = proposals.slice(0, limit);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ proposals }, null, 2),
          },
        ],
      };
    },
  );

  // --- get_proposal_details ---
  server.tool(
    "get_proposal_details",
    "Get comprehensive details about a startup proposal including pool stats, investor list, and performance data.",
    {
      proposal_id: z.string().describe("Proposal ID"),
    },
    async ({ proposal_id }) => {
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

      const details = {
        ...proposal,
        funding_progress:
          `${((proposal.capital_funded / proposal.capital_seeking) * 100).toFixed(1)}%`,
        investors_count: Math.floor(Math.random() * 20) + 1,
        days_remaining: daysUntil(proposal.created_at, proposal.commitment_period_days),
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(details, null, 2),
          },
        ],
      };
    },
  );

  // --- evaluate_proposal ---
  server.tool(
    "evaluate_proposal",
    "Get computed metrics to evaluate a startup proposal's economic viability. Returns estimated fees, projected returns, risk metrics.",
    {
      proposal_id: z.string().describe("Proposal ID"),
      investment_amount: z
        .number()
        .describe("How much the agent would invest"),
    },
    async ({ proposal_id, investment_amount }) => {
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

      const collateralRatio = parseFloat(proposal.collateral_ratio);
      const dailyFees = investment_amount * 0.0005; // ~0.05% daily
      const breakeven = Math.ceil(
        (investment_amount * 0.02) / dailyFees,
      ); // assumes ~2% cost to enter

      const evaluation: EvaluationResult = {
        proposal_id,
        investment_amount,
        estimated_daily_fees_usd: round2(dailyFees),
        estimated_monthly_fees_usd: round2(dailyFees * 30),
        pool_volume_24h: round2(investment_amount * 5 + Math.random() * 100000),
        pool_apy_current: `${(dailyFees / investment_amount * 365 * 100).toFixed(1)}%`,
        collateral_coverage: proposal.collateral_ratio,
        risk_score: collateralRatio >= 10 ? "low" : collateralRatio >= 7 ? "medium" : "high",
        similar_proposals_avg_return: "8.5%",
        breakeven_days: breakeven,
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(evaluation, null, 2),
          },
        ],
      };
    },
  );
}

// --- Helpers ---

function sortProposals(
  proposals: StartupProposal[],
  sortBy: string,
): StartupProposal[] {
  return [...proposals].sort((a, b) => {
    switch (sortBy) {
      case "capital_desc":
        return b.capital_seeking - a.capital_seeking;
      case "collateral_ratio_desc":
        return (
          parseFloat(b.collateral_ratio) - parseFloat(a.collateral_ratio)
        );
      default: // newest
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }
  });
}

function daysUntil(createdAt: string, periodDays: number): number {
  const deadline = new Date(createdAt).getTime() + periodDays * 86400000;
  return Math.max(0, Math.ceil((deadline - Date.now()) / 86400000));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
