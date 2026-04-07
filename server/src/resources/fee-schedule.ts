import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const FEE_SCHEDULE = {
  protocol_fee_bps: 1000, // 10% of profits
  startup_track: {
    description: "Startup pays ongoing fees from operations; investors earn token appreciation",
    fee_source: "Startup operational revenue",
    fee_frequency: "Ongoing during commitment period",
    pool1_fee_tier: 3000, // 0.3% Uniswap fee tier
    pool2_fee_tier: 10000, // 1% Uniswap fee tier
    early_exit_penalty: "Forfeits token allocation and claim rights; tokens redistributed to remaining investors",
  },
  collateral: {
    min_ratio_startup_bps: 500, // 5% minimum
    lock_mechanism: "ERC-8210 AssuranceAccount",
    claim_process: "Pro-rata distribution to investors on startup failure",
  },
};

export function registerFeeScheduleResource(server: McpServer): void {
  server.resource(
    "fee-schedule",
    "catalyst://protocol/fee-schedule",
    {
      description: "DeFiRe Catalyst fee schedule and economic parameters",
      mimeType: "application/json",
    },
    async () => ({
      contents: [
        {
          uri: "catalyst://protocol/fee-schedule",
          mimeType: "application/json",
          text: JSON.stringify(FEE_SCHEDULE, null, 2),
        },
      ],
    }),
  );
}
