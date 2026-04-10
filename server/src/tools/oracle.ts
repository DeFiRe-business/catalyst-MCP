import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAdoptionScorerAs } from "../blockchain/contracts.js";

const VERDICT_MAP = { PENDING: 0, APPROVE: 1, DENY: 2 } as const;

export function registerOracleTools(server: McpServer): void {
  server.tool(
    "post_adoption_score",
    `Post an adoption verdict for a startup. Requires ORACLE_PRIVATE_KEY in env. Verdicts: PENDING | APPROVE | DENY. ReasoningCID is an IPFS CID (or any bytes32) pointing to the rationale document.`,
    {
      startup_id: z.number().int().positive(),
      verdict: z.enum(["PENDING", "APPROVE", "DENY"]),
      confidence: z
        .number()
        .int()
        .min(0)
        .max(100)
        .describe("Confidence percentage 0-100"),
      reasoning_cid: z
        .string()
        .describe(
          "32-byte hex string (0x-prefixed) representing the IPFS CID or rationale hash",
        ),
    },
    async ({ startup_id, verdict, confidence, reasoning_cid }) => {
      try {
        if (!/^0x[0-9a-fA-F]{64}$/.test(reasoning_cid)) {
          throw new Error("reasoning_cid must be a 0x-prefixed 32-byte hex string");
        }

        const scorer = getAdoptionScorerAs("oracle");
        const tx = await scorer.postScore(
          BigInt(startup_id),
          VERDICT_MAP[verdict],
          confidence,
          reasoning_cid,
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
                  verdict,
                  confidence,
                  reasoning_cid,
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
