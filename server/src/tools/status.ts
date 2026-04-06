import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getProtocolStats } from "../data-store.js";

export function registerStatusTools(server: McpServer): void {
  server.tool(
    "get_protocol_stats",
    "Get global DeFiRe Catalyst protocol statistics.",
    {},
    async () => {
      const stats = getProtocolStats();
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(stats, null, 2),
          },
        ],
      };
    },
  );
}
