import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ethers } from "ethers";
import {
  getRegistry,
  getRegistryAs,
  getVault,
  getVaultAs,
  getHook,
  getAdoptionScorer,
  decodeStartup,
  decodeScore,
  serializeBigints,
  statusName,
  verdictName,
} from "../blockchain/contracts.js";

export function registerStartupTools(server: McpServer): void {
  // -------------------------------------------------------------------------
  // register_startup (write — founder)
  // -------------------------------------------------------------------------
  server.tool(
    "register_startup",
    `Register a new startup in CatalystRegistry. Sends value=collateral_wei with the call. Requires FOUNDER_PRIVATE_KEY in env. Parses the StartupRegistered event from the receipt to return the assigned startupId.`,
    {
      name: z.string().min(1).describe("Startup name"),
      description: z.string().describe("Startup description"),
      commitment_period_seconds: z
        .number()
        .int()
        .positive()
        .describe("Commitment period in seconds (added to block.timestamp)"),
      collateral_wei: z.string().describe("Collateral amount in wei (decimal string)"),
      token_alloc_for_investors: z
        .string()
        .describe("Token allocation reserved for investors (decimal string of uint256)"),
      min_token_price_wei: z
        .string()
        .describe("Minimum TOKEN price required at evaluation, in stablecoin wei"),
    },
    async ({
      name,
      description,
      commitment_period_seconds,
      collateral_wei,
      token_alloc_for_investors,
      min_token_price_wei,
    }) => {
      try {
        const registry = getRegistryAs("founder");
        const collateral = BigInt(collateral_wei);

        const tx = await registry.registerStartup(
          name,
          description,
          BigInt(commitment_period_seconds),
          collateral,
          BigInt(token_alloc_for_investors),
          BigInt(min_token_price_wei),
          { value: collateral },
        );
        const receipt = await tx.wait();

        // Parse StartupRegistered to extract assigned startupId.
        let startupId: string | null = null;
        let tokenAddress: string | null = null;
        if (receipt) {
          const iface = registry.interface;
          for (const log of receipt.logs) {
            try {
              const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
              if (parsed?.name === "StartupRegistered") {
                startupId = BigInt(parsed.args[0]).toString();
                tokenAddress = String(parsed.args[3]);
                break;
              }
            } catch {
              // not our event
            }
          }
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  startup_id: startupId,
                  token_address: tokenAddress,
                  tx_hash: tx.hash,
                  block_number: receipt?.blockNumber,
                },
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

  // -------------------------------------------------------------------------
  // deposit_extra_collateral (write — founder)
  // -------------------------------------------------------------------------
  server.tool(
    "deposit_extra_collateral",
    `Top up an existing startup's collateral via CollateralVault.deposit{value: amount}(jobId). Requires FOUNDER_PRIVATE_KEY (the deposit caller must be the startup owner).`,
    {
      startup_id: z.number().int().positive().describe("Startup id"),
      amount_wei: z.string().describe("Amount to deposit, in wei (decimal string)"),
    },
    async ({ startup_id, amount_wei }) => {
      try {
        const vault = getVaultAs("founder");
        const tx = await vault.deposit(BigInt(startup_id), { value: BigInt(amount_wei) });
        const receipt = await tx.wait();

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  startup_id,
                  amount_wei,
                  tx_hash: tx.hash,
                  block_number: receipt?.blockNumber,
                },
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

  // -------------------------------------------------------------------------
  // get_my_startup_status (read — founder view)
  // -------------------------------------------------------------------------
  server.tool(
    "get_my_startup_status",
    `Founder-facing status snapshot for one startup: full registry struct + remaining collateral (vault) + investor count (hook) + token price (hook) + adoption score.`,
    {
      startup_id: z.number().int().positive().describe("Startup id"),
    },
    async ({ startup_id }) => {
      try {
        const registry = getRegistry();
        const vault = getVault();
        const hook = getHook();
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

        const [claimedRaw, investorCountRaw, priceRaw, scoreRaw] =
          await Promise.allSettled([
            vault.claimedFromJob(startup_id),
            hook.getInvestorCount(startup_id),
            hook.getTokenPriceInStables(startup_id),
            scorer.getScore(startup_id),
          ]);

        const claimed: bigint =
          claimedRaw.status === "fulfilled" ? BigInt(claimedRaw.value) : 0n;
        const remaining_collateral = info.collateral - claimed;

        let adoption_score = null;
        if (scoreRaw.status === "fulfilled") {
          const s = decodeScore(scoreRaw.value);
          if (s.timestamp > 0n) {
            adoption_score = {
              verdict: verdictName(s.verdict),
              confidence: s.confidence,
              reasoning_cid: s.reasoningCID,
              timestamp: s.timestamp,
            };
          }
        }

        const out = {
          startup_id,
          owner: info.owner,
          name: info.name,
          description: info.description,
          status: statusName(info.status),
          token: info.token,
          pool1: info.pool1,
          pool2: info.pool2,
          original_collateral: info.collateral,
          claimed_collateral: claimed,
          remaining_collateral,
          commitment_deadline: info.commitmentDeadline,
          total_funding: info.totalFunding,
          min_token_price: info.minTokenPrice,
          investor_count:
            investorCountRaw.status === "fulfilled" ? Number(investorCountRaw.value) : null,
          token_price_in_stables:
            priceRaw.status === "fulfilled" ? BigInt(priceRaw.value) : null,
          adoption_score,
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(serializeBigints(out), null, 2),
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
