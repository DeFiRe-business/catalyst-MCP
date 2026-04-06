import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerMarketplaceTools } from "./tools/marketplace.js";
import { registerStatusTools } from "./tools/status.js";
import { registerLeaderboardTools } from "./tools/leaderboard.js";
import { registerInvestorTools } from "./tools/investor.js";
import { registerStartupTools } from "./tools/startup.js";
import { registerTradingTools } from "./tools/trading.js";
import { registerProtocolStatsResource } from "./resources/protocol-stats.js";
import { registerFeeScheduleResource } from "./resources/fee-schedule.js";

const server = new McpServer({
  name: "defire-catalyst",
  version: "0.1.0",
});

// Register all tools
registerMarketplaceTools(server);
registerStatusTools(server);
registerLeaderboardTools(server);
registerInvestorTools(server);
registerStartupTools(server);
registerTradingTools(server);

// Register resources
registerProtocolStatsResource(server);
registerFeeScheduleResource(server);

// Start with stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
