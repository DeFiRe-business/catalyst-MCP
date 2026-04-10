import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ethers } from "ethers";
import {
  getEvalRegistryAs,
  getAdoptionScorerAs,
  getEvaluatorAs,
  getRegistryAs,
} from "../blockchain/contracts.js";

const STATUS_MAP = { Funding: 0, Active: 1, Completed: 2, Failed: 3 } as const;

function ok(payload: Record<string, unknown>) {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify(payload, null, 2) },
    ],
  };
}

function fail(err: unknown) {
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

export function registerAdminTools(server: McpServer): void {
  // -------------------------------------------------------------------------
  // slash_evaluator
  // -------------------------------------------------------------------------
  server.tool(
    "slash_evaluator",
    `Slash an evaluator's stake. Requires ADMIN_PRIVATE_KEY (must be the EvaluatorRegistry owner).`,
    {
      evaluator: z.string().describe("Evaluator EOA address"),
      job_id: z.number().int().positive(),
      slashed_amount_wei: z.string().describe("Amount to slash in wei"),
      reason: z
        .string()
        .describe("bytes32 reason code (0x-prefixed 32-byte hex)"),
    },
    async ({ evaluator, job_id, slashed_amount_wei, reason }) => {
      try {
        if (!ethers.isAddress(evaluator)) throw new Error("Invalid evaluator address");
        if (!/^0x[0-9a-fA-F]{64}$/.test(reason)) {
          throw new Error("reason must be a 0x-prefixed 32-byte hex string");
        }
        const reg = getEvalRegistryAs("admin");
        const tx = await reg.slashEvaluator(
          evaluator,
          BigInt(job_id),
          BigInt(slashed_amount_wei),
          reason,
        );
        const receipt = await tx.wait();
        return ok({
          success: true,
          evaluator,
          job_id,
          slashed_amount_wei,
          tx_hash: tx.hash,
          block_number: receipt?.blockNumber,
        });
      } catch (err) {
        return fail(err);
      }
    },
  );

  // -------------------------------------------------------------------------
  // register_evaluator
  // -------------------------------------------------------------------------
  server.tool(
    "register_evaluator",
    `Register a new evaluator and post the initial stake. Requires ADMIN_PRIVATE_KEY. Sends value=stake_wei with the call.`,
    {
      evaluator: z.string().describe("Evaluator EOA address"),
      stake_wei: z.string().describe("Initial stake in wei (must be >= minStake)"),
    },
    async ({ evaluator, stake_wei }) => {
      try {
        if (!ethers.isAddress(evaluator)) throw new Error("Invalid evaluator address");
        const reg = getEvalRegistryAs("admin");
        const tx = await reg.registerEvaluator(evaluator, { value: BigInt(stake_wei) });
        const receipt = await tx.wait();
        return ok({
          success: true,
          evaluator,
          stake_wei,
          tx_hash: tx.hash,
          block_number: receipt?.blockNumber,
        });
      } catch (err) {
        return fail(err);
      }
    },
  );

  // -------------------------------------------------------------------------
  // withdraw_evaluator_stake
  // -------------------------------------------------------------------------
  server.tool(
    "withdraw_evaluator_stake",
    `Withdraw stake on behalf of an evaluator. Requires ADMIN_PRIVATE_KEY (registry owner). Funds are sent to msg.sender (the admin EOA).`,
    {
      evaluator: z.string().describe("Evaluator EOA address"),
      amount_wei: z.string().describe("Amount to withdraw in wei"),
    },
    async ({ evaluator, amount_wei }) => {
      try {
        if (!ethers.isAddress(evaluator)) throw new Error("Invalid evaluator address");
        const reg = getEvalRegistryAs("admin");
        const tx = await reg.withdraw(evaluator, BigInt(amount_wei));
        const receipt = await tx.wait();
        return ok({
          success: true,
          evaluator,
          amount_wei,
          tx_hash: tx.hash,
          block_number: receipt?.blockNumber,
        });
      } catch (err) {
        return fail(err);
      }
    },
  );

  // -------------------------------------------------------------------------
  // set_min_stake
  // -------------------------------------------------------------------------
  server.tool(
    "set_min_stake",
    `Update the minimum evaluator stake. Requires ADMIN_PRIVATE_KEY.`,
    {
      min_stake_wei: z.string().describe("New minimum stake in wei"),
    },
    async ({ min_stake_wei }) => {
      try {
        const reg = getEvalRegistryAs("admin");
        const tx = await reg.setMinStake(BigInt(min_stake_wei));
        const receipt = await tx.wait();
        return ok({
          success: true,
          min_stake_wei,
          tx_hash: tx.hash,
          block_number: receipt?.blockNumber,
        });
      } catch (err) {
        return fail(err);
      }
    },
  );

  // -------------------------------------------------------------------------
  // set_oracle
  // -------------------------------------------------------------------------
  server.tool(
    "set_oracle",
    `Rotate the AdoptionScorer oracle EOA. Requires ADMIN_PRIVATE_KEY (must be the AdoptionScorer owner).`,
    {
      new_oracle: z.string().describe("New oracle EOA address"),
    },
    async ({ new_oracle }) => {
      try {
        if (!ethers.isAddress(new_oracle)) throw new Error("Invalid oracle address");
        const scorer = getAdoptionScorerAs("admin");
        const tx = await scorer.setOracle(new_oracle);
        const receipt = await tx.wait();
        return ok({
          success: true,
          new_oracle,
          tx_hash: tx.hash,
          block_number: receipt?.blockNumber,
        });
      } catch (err) {
        return fail(err);
      }
    },
  );

  // -------------------------------------------------------------------------
  // evaluate_job
  // -------------------------------------------------------------------------
  server.tool(
    "evaluate_job",
    `Force-trigger PerformanceEvaluator.evaluate(jobId). Permissionless on the contract, but kept under admin role here so a casual reader doesn't accidentally finalize a startup. Production deployments should run an off-chain keeper instead.`,
    {
      job_id: z.number().int().positive().describe("Startup job id to evaluate"),
    },
    async ({ job_id }) => {
      try {
        const evaluator = getEvaluatorAs("admin");
        const tx = await evaluator.evaluate(BigInt(job_id));
        const receipt = await tx.wait();
        return ok({
          success: true,
          job_id,
          tx_hash: tx.hash,
          block_number: receipt?.blockNumber,
        });
      } catch (err) {
        return fail(err);
      }
    },
  );

  // -------------------------------------------------------------------------
  // update_status
  // -------------------------------------------------------------------------
  server.tool(
    "update_status",
    `Admin override for the startup status. Requires ADMIN_PRIVATE_KEY (must be a CatalystRegistry authorized caller — owner, hook, or evaluator).`,
    {
      startup_id: z.number().int().positive(),
      new_status: z.enum(["Funding", "Active", "Completed", "Failed"]),
    },
    async ({ startup_id, new_status }) => {
      try {
        const registry = getRegistryAs("admin");
        const tx = await registry.updateStatus(BigInt(startup_id), STATUS_MAP[new_status]);
        const receipt = await tx.wait();
        return ok({
          success: true,
          startup_id,
          new_status,
          tx_hash: tx.hash,
          block_number: receipt?.blockNumber,
        });
      } catch (err) {
        return fail(err);
      }
    },
  );
}
