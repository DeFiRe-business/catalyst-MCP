import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ethers } from "ethers";
import {
  getRegistry,
  getVault,
  getEvalRegistry,
  getAdoptionScorer,
  decodeStartup,
  decodeScore,
  serializeBigints,
  statusName,
} from "../blockchain/contracts.js";

const MAX_STARTUPS = Number(process.env.MAX_STARTUPS ?? 100);
const BACKEND_URL = process.env.BACKEND_URL;

export function registerStatusTools(server: McpServer): void {
  server.tool(
    "get_protocol_stats",
    `Aggregated Catalyst protocol statistics. If BACKEND_URL is set, delegates to {BACKEND_URL}/api/stats. Otherwise computes on-chain: total startups, breakdown by status, total locked collateral, total claimed collateral, total slashed evaluator funds, and number of adoption scores posted in the last 30 days.`,
    {},
    async () => {
      try {
        if (BACKEND_URL) {
          const url = `${BACKEND_URL.replace(/\/$/, "")}/api/stats`;
          const res = await fetch(url);
          if (!res.ok) {
            throw new Error(`Backend responded ${res.status}: ${await res.text()}`);
          }
          const json = (await res.json()) as unknown;
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ source: "backend", stats: json }, null, 2),
              },
            ],
          };
        }

        const registry = getRegistry();
        const vault = getVault();
        const evalRegistry = getEvalRegistry();
        const scorer = getAdoptionScorer();

        const statusCounts = { funding: 0, active: 0, completed: 0, failed: 0 };
        let totalStartups = 0;
        let totalLockedCollateral = 0n;
        let totalClaimed = 0n;
        const startupIds: number[] = [];

        for (let id = 1; id <= MAX_STARTUPS; id++) {
          const raw = await registry.getStartup(id);
          const info = decodeStartup(raw);
          if (info.owner === ethers.ZeroAddress) break;

          totalStartups++;
          startupIds.push(id);
          const sName = statusName(info.status);
          statusCounts[sName]++;
          totalLockedCollateral += info.collateral;

          try {
            const claimed: bigint = await vault.claimedFromJob(id);
            totalClaimed += claimed;
          } catch {
            // ignore — vault may not be wired
          }
        }

        let totalSlashed = 0n;
        try {
          totalSlashed = BigInt(await evalRegistry.totalSlashedFunds());
        } catch {
          // ignore
        }

        // Count adoption scores posted in the last 30 days.
        const thirtyDaysAgo = BigInt(Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60);
        let scoresLast30d = 0;
        for (const id of startupIds) {
          try {
            const raw = await scorer.getScore(id);
            const s = decodeScore(raw);
            if (s.timestamp >= thirtyDaysAgo) scoresLast30d++;
          } catch {
            // ignore
          }
        }

        const stats = {
          total_startups: totalStartups,
          status_counts: statusCounts,
          total_locked_collateral: totalLockedCollateral - totalClaimed,
          total_original_collateral: totalLockedCollateral,
          total_claimed_collateral: totalClaimed,
          total_slashed_evaluator_funds: totalSlashed,
          adoption_scores_posted_last_30d: scoresLast30d,
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { source: "chain", stats: serializeBigints(stats) },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: false,
                error: err instanceof Error ? err.message : String(err),
              }),
            },
          ],
          isError: true,
        };
      }
    },
  );
}
