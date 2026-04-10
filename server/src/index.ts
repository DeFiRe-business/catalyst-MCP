import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerMarketplaceTools } from "./tools/marketplace.js";
import { registerStatusTools } from "./tools/status.js";
import { registerLeaderboardTools } from "./tools/leaderboard.js";
import { registerInvestorTools } from "./tools/investor.js";
import { registerStartupTools } from "./tools/startup.js";
import { registerOracleTools } from "./tools/oracle.js";
import { registerAdminTools } from "./tools/admin.js";

const server = new McpServer({
  name: "defire-catalyst",
  version: "0.2.0",
});

// Read tools
registerMarketplaceTools(server);
registerStatusTools(server);
registerLeaderboardTools(server);

// Mixed read/write tools
registerInvestorTools(server);
registerStartupTools(server);

// Write-only tool groups (require role-specific signing keys)
registerOracleTools(server);
registerAdminTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);
