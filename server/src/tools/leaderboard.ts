import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getLeaderboardData } from "../data-store.js";

export function registerLeaderboardTools(server: McpServer): void {
  server.tool(
    "get_leaderboard",
    "Get ranked leaderboard of startups by token appreciation, Pool 2 volume, investor count, or launch recency.",
    {
      period: z
        .enum(["7d", "30d", "90d", "all"])
        .default("30d")
        .describe("Time period"),
      sort_by: z
        .enum(["token_appreciation", "pool2_volume", "investor_count", "days_since_launch"])
        .default("token_appreciation")
        .describe("Sort metric"),
      limit: z.number().default(10).describe("Max results"),
    },
    async ({ period, sort_by, limit }) => {
      const entries = getLeaderboardData(period, sort_by, limit);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ period, leaderboard: entries }, null, 2),
          },
        ],
      };
    },
  );
}
