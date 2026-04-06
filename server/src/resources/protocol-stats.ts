import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getProtocolStats } from "../data-store.js";

export function registerProtocolStatsResource(server: McpServer): void {
  server.resource(
    "protocol-stats",
    "catalyst://protocol/stats",
    {
      description: "Current DeFiRe Catalyst protocol statistics (read-only)",
      mimeType: "application/json",
    },
    async () => ({
      contents: [
        {
          uri: "catalyst://protocol/stats",
          mimeType: "application/json",
          text: JSON.stringify(getProtocolStats(), null, 2),
        },
      ],
    }),
  );
}
