import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ethers } from "ethers";
import {
  getRegistry,
  getHook,
  getVault,
  getAdoptionScorer,
  decodeStartup,
  decodeScore,
  serializeBigints,
  statusName,
  verdictName,
  type StartupInfo,
} from "../blockchain/contracts.js";

const MAX_STARTUPS = Number(process.env.MAX_STARTUPS ?? 100);

interface ListedStartup {
  startup_id: number;
  owner: string;
  name: string;
  description: string;
  status: string;
  token: string;
  pool1: string;
  pool2: string;
  collateral: string;
  commitment_deadline: string;
  total_funding: string;
  min_token_price: string;
}

function toListed(id: number, info: StartupInfo): ListedStartup {
  return {
    startup_id: id,
    owner: info.owner,
    name: info.name,
    description: info.description,
    status: statusName(info.status),
    token: info.token,
    pool1: info.pool1,
    pool2: info.pool2,
    collateral: info.collateral.toString(),
    commitment_deadline: info.commitmentDeadline.toString(),
    total_funding: info.totalFunding.toString(),
    min_token_price: info.minTokenPrice.toString(),
  };
}

export function registerMarketplaceTools(server: McpServer): void {
  // -------------------------------------------------------------------------
  // list_startups
  // -------------------------------------------------------------------------
  server.tool(
    "list_startups",
    `List startups registered on Catalyst. Iterates the on-chain registry from id 1 upward (capped at MAX_STARTUPS, default 100). Stops at the first all-zero entry, then filters zero-owner records.`,
    {
      status: z
        .enum(["funding", "active", "completed", "failed", "all"])
        .default("all")
        .describe("Filter by status"),
      limit: z.number().int().positive().default(50).describe("Max results to return"),
    },
    async ({ status, limit }) => {
      try {
        const registry = getRegistry();
        const out: ListedStartup[] = [];

        for (let id = 1; id <= MAX_STARTUPS; id++) {
          const raw = await registry.getStartup(id);
          const info = decodeStartup(raw);
          if (info.owner === ethers.ZeroAddress) {
            // First all-zero record marks the end of the registered range.
            break;
          }
          if (status !== "all" && statusName(info.status) !== status) {
            continue;
          }
          out.push(toListed(id, info));
          if (out.length >= limit) break;
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ count: out.length, startups: out }, null, 2),
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

  // -------------------------------------------------------------------------
  // get_startup_details
  // -------------------------------------------------------------------------
  server.tool(
    "get_startup_details",
    `Detailed view of a single startup. Returns the full registry struct plus committed collateral (from CollateralVault), investor count (from CatalystHook), current TOKEN price in stables (from CatalystHook.getTokenPriceInStables), and the latest adoption score (from CatalystAdoptionScorer.getScore).`,
    {
      startup_id: z.number().int().positive().describe("Startup id (uint256)"),
    },
    async ({ startup_id }) => {
      try {
        const registry = getRegistry();
        const hook = getHook();
        const vault = getVault();
        const scorer = getAdoptionScorer();

        const raw = await registry.getStartup(startup_id);
        const info = decodeStartup(raw);
        if (info.owner === ethers.ZeroAddress) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ error: "Startup not found", startup_id }),
              },
            ],
            isError: true,
          };
        }

        const [investorCountRaw, claimedRaw, tokenPriceRaw, scoreRaw] =
          await Promise.allSettled([
            hook.getInvestorCount(startup_id),
            vault.claimedFromJob(startup_id),
            hook.getTokenPriceInStables(startup_id),
            scorer.getScore(startup_id),
          ]);

        const investor_count =
          investorCountRaw.status === "fulfilled" ? Number(investorCountRaw.value) : null;

        const claimed: bigint =
          claimedRaw.status === "fulfilled" ? BigInt(claimedRaw.value) : 0n;
        const committed_collateral = (info.collateral - claimed).toString();

        const token_price_in_stables =
          tokenPriceRaw.status === "fulfilled" ? BigInt(tokenPriceRaw.value).toString() : null;

        let adoption_score = null;
        if (scoreRaw.status === "fulfilled") {
          const s = decodeScore(scoreRaw.value);
          if (s.timestamp > 0n) {
            adoption_score = {
              verdict: verdictName(s.verdict),
              confidence: s.confidence,
              reasoning_cid: s.reasoningCID,
              timestamp: s.timestamp.toString(),
            };
          }
        }

        const details = {
          ...toListed(startup_id, info),
          claimed_collateral: claimed.toString(),
          committed_collateral,
          investor_count,
          token_price_in_stables,
          adoption_score,
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(serializeBigints(details), null, 2),
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
