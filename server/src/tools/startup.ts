import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  registerStartup,
  getStartupStatus,
  buybackToken,
} from "../data-store.js";

const CONNECTED_WALLET = process.env.WALLET_ADDRESS ?? "default";

export function registerStartupTools(server: McpServer): void {
  // --- register_startup ---
  server.tool(
    "register_startup",
    "Register a new startup on DeFiRe Catalyst. Creates TOKEN automatically, deploys Pool 1 and Pool 2, and locks collateral.",
    {
      name: z.string().describe("Startup name"),
      description: z.string().describe("Startup description"),
      capital_seeking: z.number().describe("Total funding sought in USD"),
      collateral_amount: z.number().describe("Collateral to deposit in USDx"),
      commitment_period_days: z
        .number()
        .describe("How long investors commit capital"),
      token_name: z.string().describe("Name for the startup token"),
      token_symbol: z
        .string()
        .describe("Symbol for the startup token (3-5 chars)"),
      token_allocation_investors: z
        .number()
        .optional()
        .describe("Percentage of token supply for investors (e.g., 20)"),
      min_token_price_target: z
        .number()
        .optional()
        .describe("Minimum token price at evaluation (in USDx)"),
    },
    async (params) => {
      if (params.collateral_amount <= 0 || params.capital_seeking <= 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "collateral_amount and capital_seeking must be positive",
              }),
            },
          ],
          isError: true,
        };
      }

      const minRatio = 0.05;
      if (params.collateral_amount / params.capital_seeking < minRatio) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: `Collateral ratio too low. Minimum is ${minRatio * 100}%. Provided: ${((params.collateral_amount / params.capital_seeking) * 100).toFixed(2)}%`,
              }),
            },
          ],
          isError: true,
        };
      }

      const result = registerStartup({
        ...params,
        owner: CONNECTED_WALLET,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                startup_id: result.startup_id,
                name: params.name,
                token_name: params.token_name,
                token_symbol: params.token_symbol,
                token_address: result.token_address,
                pool1_address: result.pool1_address,
                pool2_address: result.pool2_address,
                collateral_locked: params.collateral_amount,
                collateral_ratio:
                  ((params.collateral_amount / params.capital_seeking) * 100).toFixed(2) + "%",
                tx_hash: result.tx_hash,
                message: `Startup "${params.name}" registered. TOKEN ${params.token_symbol} created. Pool 1 & Pool 2 deployed. Collateral locked.`,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // --- get_my_startup_status ---
  server.tool(
    "get_my_startup_status",
    "Get current status: funding progress, fees received, token price, investor count, time remaining.",
    {
      startup_id: z.string().describe("Startup ID"),
    },
    async ({ startup_id }) => {
      const status = getStartupStatus(startup_id);
      if (!status) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "Startup not found",
                startup_id,
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
            text: JSON.stringify(status, null, 2),
          },
        ],
      };
    },
  );

  // --- buyback_token ---
  server.tool(
    "buyback_token",
    "Buy back the startup's TOKEN on Pool 2 using USDx. Creates buy pressure and increases token value for investors.",
    {
      startup_id: z.string().describe("Startup ID"),
      amount_usdx: z
        .number()
        .describe("Amount of USDx to spend on buyback"),
      max_slippage_bps: z
        .number()
        .default(100)
        .describe("Max slippage in basis points"),
    },
    async ({ startup_id, amount_usdx, max_slippage_bps }) => {
      if (amount_usdx <= 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ error: "amount_usdx must be positive" }),
            },
          ],
          isError: true,
        };
      }

      const result = buybackToken(startup_id, amount_usdx, max_slippage_bps);
      if (!result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                error: "Startup not found",
                startup_id,
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
                startup_id,
                usdx_spent: amount_usdx,
                tokens_bought: result.tokens_bought,
                avg_price: result.avg_price,
                slippage_bps: result.slippage_bps,
                tx_hash: result.tx_hash,
                message: `Bought ${result.tokens_bought} tokens at avg price ${result.avg_price} USDx (${result.slippage_bps}bps slippage)`,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
