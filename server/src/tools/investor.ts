import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ethers } from "ethers";
import {
  getRegistry,
  getHook,
  getVault,
  getVaultAs,
  getAdoptionScorer,
  decodeStartup,
  decodeScore,
  serializeBigints,
  statusName,
  verdictName,
} from "../blockchain/contracts.js";

const MAX_STARTUPS = Number(process.env.MAX_STARTUPS ?? 100);

interface PositionEntry {
  startup_id: number;
  startup_name: string;
  status: string;
  liquidity: string;
  token_allocation: string;
}

interface ClaimEntry {
  startup_id: number;
  startup_name: string;
  amount: string;
  upstream: string;
  reasoning_cid: string;
  slash_evidence_hash: string;
  timestamp: string;
}

export function registerInvestorTools(server: McpServer): void {
  // -------------------------------------------------------------------------
  // get_my_positions
  // -------------------------------------------------------------------------
  server.tool(
    "get_my_positions",
    `List the investor's non-zero positions across every registered startup. Reads CatalystHook.investorPositions(jobId, wallet) and CatalystHook.tokenAllocations(jobId, wallet).`,
    {
      wallet_address: z.string().describe("EVM address of the investor"),
    },
    async ({ wallet_address }) => {
      try {
        if (!ethers.isAddress(wallet_address)) {
          throw new Error(`Invalid wallet_address: ${wallet_address}`);
        }
        const registry = getRegistry();
        const hook = getHook();
        const positions: PositionEntry[] = [];

        for (let id = 1; id <= MAX_STARTUPS; id++) {
          const raw = await registry.getStartup(id);
          const info = decodeStartup(raw);
          if (info.owner === ethers.ZeroAddress) break;

          const [liquidity, allocation] = await Promise.all([
            hook.investorPositions(id, wallet_address) as Promise<bigint>,
            hook.tokenAllocations(id, wallet_address) as Promise<bigint>,
          ]);

          if (liquidity > 0n || allocation > 0n) {
            positions.push({
              startup_id: id,
              startup_name: info.name,
              status: statusName(info.status),
              liquidity: liquidity.toString(),
              token_allocation: allocation.toString(),
            });
          }
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  wallet: wallet_address,
                  count: positions.length,
                  positions,
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
  // get_my_claims
  // -------------------------------------------------------------------------
  server.tool(
    "get_my_claims",
    `List every claim filed by the wallet against failed startups. Reads CollateralVault.claims(jobId, wallet). Returns only entries where timestamp > 0.`,
    {
      wallet_address: z.string().describe("EVM address of the claimant"),
    },
    async ({ wallet_address }) => {
      try {
        if (!ethers.isAddress(wallet_address)) {
          throw new Error(`Invalid wallet_address: ${wallet_address}`);
        }
        const registry = getRegistry();
        const vault = getVault();
        const out: ClaimEntry[] = [];

        for (let id = 1; id <= MAX_STARTUPS; id++) {
          const raw = await registry.getStartup(id);
          const info = decodeStartup(raw);
          if (info.owner === ethers.ZeroAddress) break;

          try {
            const c = await vault.claims(id, wallet_address);
            // c is a tuple: (jobId, claimant, amount, upstream, reasoningCID, slashEvidenceHash, timestamp)
            const timestamp = BigInt(c[6]);
            if (timestamp === 0n) continue;
            out.push({
              startup_id: id,
              startup_name: info.name,
              amount: BigInt(c[2]).toString(),
              upstream: String(c[3]),
              reasoning_cid: String(c[4]),
              slash_evidence_hash: String(c[5]),
              timestamp: timestamp.toString(),
            });
          } catch {
            // skip jobs without a claim entry
          }
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { wallet: wallet_address, count: out.length, claims: out },
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
  // get_startup_score
  // -------------------------------------------------------------------------
  server.tool(
    "get_startup_score",
    `Latest adoption verdict for a startup from CatalystAdoptionScorer.getScore(jobId). Verdict is one of "PENDING" | "APPROVE" | "DENY". A timestamp of 0 means no score has been posted.`,
    {
      startup_id: z.number().int().positive().describe("Startup id"),
    },
    async ({ startup_id }) => {
      try {
        const scorer = getAdoptionScorer();
        const raw = await scorer.getScore(startup_id);
        const s = decodeScore(raw);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                serializeBigints({
                  startup_id,
                  verdict: verdictName(s.verdict),
                  confidence: s.confidence,
                  reasoning_cid: s.reasoningCID,
                  timestamp: s.timestamp,
                  posted: s.timestamp > 0n,
                }),
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
  // file_claim (write — investor role)
  // -------------------------------------------------------------------------
  server.tool(
    "file_claim",
    `File a claim against a failed startup's collateral via CollateralVault.fileClaim. Requires INVESTOR_PRIVATE_KEY in env. The amount and bytes32 fields are passed verbatim — pass 0x followed by 64 zeros for unused upstream/reasoning/slash fields.`,
    {
      startup_id: z.number().int().positive().describe("Startup id (uint256)"),
      amount_wei: z.string().describe("Claim amount in wei (decimal string)"),
      upstream: z
        .string()
        .default("0x0000000000000000000000000000000000000000000000000000000000000000")
        .describe("bytes32 upstream reference (Scenario 1). Pass 32 zero bytes if unused."),
      reasoning_cid: z
        .string()
        .default("0x0000000000000000000000000000000000000000000000000000000000000000")
        .describe("bytes32 reasoning CID (Scenario 3). Pass 32 zero bytes if unused."),
      slash_evidence_hash: z
        .string()
        .default("0x0000000000000000000000000000000000000000000000000000000000000000")
        .describe("bytes32 slash evidence hash (Scenario 2). Pass 32 zero bytes if unused."),
    },
    async ({ startup_id, amount_wei, upstream, reasoning_cid, slash_evidence_hash }) => {
      try {
        for (const [name, val] of [
          ["upstream", upstream],
          ["reasoning_cid", reasoning_cid],
          ["slash_evidence_hash", slash_evidence_hash],
        ] as const) {
          if (!/^0x[0-9a-fA-F]{64}$/.test(val)) {
            throw new Error(`${name} must be a 0x-prefixed 32-byte hex string`);
          }
        }

        const vault = getVaultAs("investor");
        const tx = await vault.fileClaim(
          BigInt(startup_id),
          BigInt(amount_wei),
          upstream,
          reasoning_cid,
          slash_evidence_hash,
        );
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
}
