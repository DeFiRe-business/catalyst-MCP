import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ethers } from "ethers";
import {
  getRegistry,
  getHook,
  decodeStartup,
  serializeBigints,
  statusName,
  type StartupInfo,
} from "../blockchain/contracts.js";

const MAX_STARTUPS = Number(process.env.MAX_STARTUPS ?? 100);
const BACKEND_URL = process.env.BACKEND_URL;

/**
 * Ranking metric:
 *   - Active startups are ranked by `total_funding` (descending).
 *   - Completed startups are ranked after active ones by `total_funding`.
 *   - Failing/funding startups are excluded by default.
 *
 * The metric is intentionally simple — a richer ranking (token appreciation
 * over time, fee generation rate) belongs in the off-chain backend indexer.
 * When BACKEND_URL is set, the tool delegates to ${BACKEND_URL}/api/leaderboard
 * for the production-grade ranking.
 */
export function registerLeaderboardTools(server: McpServer): void {
  server.tool(
    "get_leaderboard",
    `Ranked list of Catalyst startups. If BACKEND_URL is set, delegates to {BACKEND_URL}/api/leaderboard. Otherwise computes on-chain: ranks Active startups by totalFunding descending, then Completed startups by totalFunding descending. Funding/Failed are excluded unless include_all=true.`,
    {
      limit: z.number().int().positive().default(10).describe("Max entries to return"),
      include_all: z
        .boolean()
        .default(false)
        .describe("If true, also include funding/failed startups"),
    },
    async ({ limit, include_all }) => {
      try {
        if (BACKEND_URL) {
          const url = `${BACKEND_URL.replace(/\/$/, "")}/api/leaderboard?limit=${limit}`;
          const res = await fetch(url);
          if (!res.ok) {
            throw new Error(`Backend responded ${res.status}: ${await res.text()}`);
          }
          const json = (await res.json()) as unknown;
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ source: "backend", leaderboard: json }, null, 2),
              },
            ],
          };
        }

        const registry = getRegistry();
        const collected: Array<{ id: number; info: StartupInfo }> = [];

        for (let id = 1; id <= MAX_STARTUPS; id++) {
          const raw = await registry.getStartup(id);
          const info = decodeStartup(raw);
          if (info.owner === ethers.ZeroAddress) break;
          collected.push({ id, info });
        }

        const eligible = include_all
          ? collected
          : collected.filter(({ info }) => {
              const s = statusName(info.status);
              return s === "active" || s === "completed";
            });

        const ranked = eligible
          .map(({ id, info }) => ({
            startup_id: id,
            name: info.name,
            owner: info.owner,
            status: statusName(info.status),
            total_funding: info.totalFunding,
            collateral: info.collateral,
            commitment_deadline: info.commitmentDeadline,
          }))
          .sort((a, b) => {
            // Active before completed, then by total_funding descending.
            const orderA = a.status === "active" ? 0 : a.status === "completed" ? 1 : 2;
            const orderB = b.status === "active" ? 0 : b.status === "completed" ? 1 : 2;
            if (orderA !== orderB) return orderA - orderB;
            if (a.total_funding > b.total_funding) return -1;
            if (a.total_funding < b.total_funding) return 1;
            return 0;
          })
          .slice(0, limit)
          .map((entry, idx) => ({ rank: idx + 1, ...entry }));

        // Optionally enrich the top of the list with current token prices.
        const hook = getHook();
        const enriched = await Promise.all(
          ranked.map(async (entry) => {
            try {
              const price: bigint = await hook.getTokenPriceInStables(entry.startup_id);
              return { ...entry, token_price_in_stables: price };
            } catch {
              return { ...entry, token_price_in_stables: null };
            }
          }),
        );

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                serializeBigints({ source: "chain", leaderboard: enriched }),
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
