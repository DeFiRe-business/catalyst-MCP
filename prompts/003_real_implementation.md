# 003 — Real implementation: rewrite MCP server with actual chain reads/writes + oracle tool

The current MCP server (`server/src/`) is a simulation:

- `data-store.ts` exports hardcoded startups, fake protocol stats, fake leaderboards.
- `blockchain/contracts.ts` declares ABIs with **wrong signatures** completely disconnected from the real contracts. The `getStartup` ABI claims a 14-field tuple including invented fields like `capitalSeeking`, `capitalFunded`, `tokenAllocationInvestorsBps`, `tokenAddress`, `pool1`, `pool2`, `tokenName`, `tokenSymbol`. The real struct from `ICatalystRegistry.StartupInfo` has 11 fields with different names. The `registerStartup` signature in the MCP takes 8 arguments including `tokenName`, `tokenSymbol`, `capitalSeeking` — the real signature is `(name, description, commitmentPeriod, collateralAmount, tokenAllocForInvestors, minTokenPrice) payable`.
- `tools/startup.ts::register_startup` calls a mock `registerStartup` from `data-store.ts` and returns a fake `tx_hash`. **Signs nothing.** Same for `buyback_token` (which calls `CatalystHook.buybackToken`, a function that does not exist on the real contract — buyback is automatic via the `BuybackTriggered` event in the fee distribution flow).
- `config.ts` only reads `WALLET_ADDRESS` (a read-only address). Zero `PRIVATE_KEY` handling. Zero `ethers.Wallet`. The server cannot send transactions even in principle.
- `resources/protocol-stats.ts` and `resources/fee-schedule.ts` serve hardcoded data via the MCP resources protocol.

This prompt replaces all of that. After this prompt the MCP server:

1. Reads the real chain via ethers.js using the same ABIs that the backend (`packages/backend/src/abi/`) and the frontend (`packages/frontend/src/lib/contracts.ts`) consume.
2. Signs and broadcasts real transactions for write tools, using **per-actor private keys** loaded from env. Includes a dedicated `oracle` role for posting adoption scores (see Cambio 5).
3. Has zero mocks. Zero `data-store.ts`. Zero hardcoded data. Resources read from chain.
4. Returns clear errors when an env var is missing instead of falling back to fake data.

## Reglas

- **NO mocks, NO fallback data, NO `data-store.ts`**. Delete the file entirely.
- **NO inventes funciones**. Read `../catalyst/packages/contracts/src/` for real signatures, or reuse the ABIs from `../catalyst/packages/backend/src/abi/` directly (already extracted in prompt 013).
- **NO añadas autenticación al MCP transport**. Stdio, single-process, single-user.
- **NO toques los `prompts/` ni el `examples/` ni el `README.md`**. Solo `server/`.
- **NO añadas dependencias** que no sean ethers + zod + el SDK MCP.
- Lo único que para el flujo: errores de TypeScript en `npm run build` desde `server/`.

## Cambio 1 — Borrar el simulacro

Delete completely:

- `server/src/data-store.ts` (hardcoded mocks)
- `server/src/types.ts` if it only contains types used by `data-store.ts`. If reusable, keep them.

Update `server/src/index.ts` to remove imports of any deleted file.

## Cambio 2 — `server/src/config.ts` con per-actor keys

Replace entirely:

```ts
import dotenv from "dotenv";
import { ethers } from "ethers";

dotenv.config();

export interface Config {
  rpcUrl: string;
  registryAddress: string;
  hookAddress: string;
  evaluatorAddress: string;
  vaultAddress: string;
  evalRegistryAddress: string;
  adoptionScorerAddress: string;
}

export type ActorRole = "founder" | "investor" | "oracle" | "admin" | "default";

const REQUIRED = [
  "RPC_URL",
  "CATALYST_REGISTRY_ADDRESS",
  "CATALYST_HOOK_ADDRESS",
  "CATALYST_EVALUATOR_ADDRESS",
  "CATALYST_VAULT_ADDRESS",
  "CATALYST_EVAL_REGISTRY_ADDRESS",
  "CATALYST_ADOPTION_SCORER_ADDRESS",
] as const;

for (const key of REQUIRED) {
  if (!process.env[key]) {
    throw new Error(`[mcp] Missing required env var: ${key}`);
  }
}

export function getConfig(): Config {
  return {
    rpcUrl: process.env.RPC_URL!,
    registryAddress: process.env.CATALYST_REGISTRY_ADDRESS!,
    hookAddress: process.env.CATALYST_HOOK_ADDRESS!,
    evaluatorAddress: process.env.CATALYST_EVALUATOR_ADDRESS!,
    vaultAddress: process.env.CATALYST_VAULT_ADDRESS!,
    evalRegistryAddress: process.env.CATALYST_EVAL_REGISTRY_ADDRESS!,
    adoptionScorerAddress: process.env.CATALYST_ADOPTION_SCORER_ADDRESS!,
  };
}

let providerInstance: ethers.JsonRpcProvider | null = null;
export function getProvider(): ethers.JsonRpcProvider {
  if (!providerInstance) {
    providerInstance = new ethers.JsonRpcProvider(getConfig().rpcUrl);
  }
  return providerInstance;
}

const ENV_KEY_BY_ROLE: Record<ActorRole, string> = {
  founder: "FOUNDER_PRIVATE_KEY",
  investor: "INVESTOR_PRIVATE_KEY",
  oracle: "ORACLE_PRIVATE_KEY",
  admin: "ADMIN_PRIVATE_KEY",
  default: "MCP_PRIVATE_KEY",
};

const walletCache = new Map<ActorRole, ethers.Wallet>();

export function getSigner(role: ActorRole): ethers.Wallet {
  if (walletCache.has(role)) return walletCache.get(role)!;

  const envKey = ENV_KEY_BY_ROLE[role];
  let pk = process.env[envKey];
  if (!pk && role !== "default") {
    pk = process.env[ENV_KEY_BY_ROLE.default];
  }
  if (!pk) {
    throw new Error(
      `[mcp] No private key configured for role '${role}'. Set ${envKey} or MCP_PRIVATE_KEY.`,
    );
  }

  const wallet = new ethers.Wallet(pk, getProvider());
  walletCache.set(role, wallet);
  return wallet;
}
```

The validation only fires when `getSigner(role)` is invoked, so the MCP can run read-only without any private keys.

## Cambio 3 — `server/src/blockchain/contracts.ts` con ABIs reales

Replace entirely. Use Human Readable ethers ABIs identical to `../catalyst/packages/backend/src/abi/` (already extracted in prompt 013 — read those files and copy literally).

```ts
import { ethers } from "ethers";
import { getConfig, getProvider, getSigner, type ActorRole } from "../config.js";

const REGISTRY_ABI = [
  // Copy from ../catalyst/packages/backend/src/abi/registry.ts
] as const;

const HOOK_ABI = [...] as const;
const EVALUATOR_ABI = [...] as const;
const VAULT_ABI = [...] as const;
const EVAL_REGISTRY_ABI = [...] as const;
const ADOPTION_SCORER_ABI = [...] as const;

export function getRegistry(): ethers.Contract {
  return new ethers.Contract(getConfig().registryAddress, REGISTRY_ABI, getProvider());
}

export function getHook(): ethers.Contract {
  return new ethers.Contract(getConfig().hookAddress, HOOK_ABI, getProvider());
}

export function getEvaluator(): ethers.Contract {
  return new ethers.Contract(getConfig().evaluatorAddress, EVALUATOR_ABI, getProvider());
}

export function getVault(): ethers.Contract {
  return new ethers.Contract(getConfig().vaultAddress, VAULT_ABI, getProvider());
}

export function getEvalRegistry(): ethers.Contract {
  return new ethers.Contract(getConfig().evalRegistryAddress, EVAL_REGISTRY_ABI, getProvider());
}

export function getAdoptionScorer(): ethers.Contract {
  return new ethers.Contract(getConfig().adoptionScorerAddress, ADOPTION_SCORER_ABI, getProvider());
}

export function getRegistryAs(role: ActorRole): ethers.Contract {
  return getRegistry().connect(getSigner(role)) as ethers.Contract;
}

export function getVaultAs(role: ActorRole): ethers.Contract {
  return getVault().connect(getSigner(role)) as ethers.Contract;
}

export function getEvaluatorAs(role: ActorRole): ethers.Contract {
  return getEvaluator().connect(getSigner(role)) as ethers.Contract;
}

export function getEvalRegistryAs(role: ActorRole): ethers.Contract {
  return getEvalRegistry().connect(getSigner(role)) as ethers.Contract;
}

export function getAdoptionScorerAs(role: ActorRole): ethers.Contract {
  return getAdoptionScorer().connect(getSigner(role)) as ethers.Contract;
}
```

Delete `blockchain/events.ts` and `blockchain/pools.ts` if they import from `data-store.ts`. If `pools.ts` has useful Uniswap v4 helpers (e.g., StateLibrary wrappers for reading `getTokenPriceInStables`), keep just those parts.

## Cambio 4 — Tool layer: read tools

For each file in `server/src/tools/`, rewrite the read tools to call ethers contracts directly. No more `data-store.ts` imports.

### `tools/marketplace.ts`

- **`list_startups`** — Iterate from id 1 upward (use `nextStartupId()` if exposed; otherwise iterate up to a configurable `MAX_STARTUPS=100` and break on first all-zero result). Filter zero-owner entries. Return mapped objects.
- **`get_startup_details`** — Takes `startup_id: number`. Returns `registry.getStartup(id)` plus `committedCollateral` from vault, `investorCount` from `hook.getInvestorCount(id)`, current `tokenPrice` from `hook.getTokenPriceInStables(id)`, and the latest adoption score from `adoptionScorer.getScore(id)` if any.

Both tools serialize bigints to strings.

### `tools/leaderboard.ts`

- **`get_leaderboard`** — If `BACKEND_URL` is set in env, fetch `${BACKEND_URL}/api/leaderboard`. Otherwise compute on-the-fly: iterate startups, fetch their score history via `adoptionScorer.getScore` and the recent fee distribution events from the hook, rank by a simple metric (active startups by `total_funding`, completed startups by success). Document the chosen metric in the tool description.

### `tools/investor.ts`

- **`get_my_positions`** — Takes `wallet_address: string`. Reads `hook.investorPositions(jobId, wallet)` and `hook.tokenAllocations(jobId, wallet)` for every active startup. Returns the non-zero positions.
- **`get_my_claims`** — Reads `vault.claims(jobId, wallet)` for every job. Returns non-zero claims.
- **`get_startup_score`** — Takes `startup_id: number`. Returns the current verdict, confidence, reasoningCID, and timestamp from `adoptionScorer.getScore(id)`. The verdict is decoded to the string `"PENDING" | "APPROVE" | "DENY"`.

### `tools/status.ts`

- **`get_protocol_stats`** — If `BACKEND_URL` is set, prefer `/api/stats`. Otherwise compute from chain: total startups, active count by status, total locked collateral, total claims, total slashed funds, total scores posted in the last 30 days.

### `tools/startup.ts` (read tool only — write tools below)

- **`get_my_startup_status`** — Takes `startup_id: number`. Returns the full struct + committed collateral + investor count + token price + score. Same as `get_startup_details` but framed as the founder's view.

## Cambio 5 — Tool layer: write tools

Same pattern as the Lockstep MCP rewrite (zod schema, try/catch, sign + send + wait + parse events, return tx hash on success, `isError: true` on failure). All bigints accepted as wei strings to avoid JS precision loss.

### `tools/startup.ts` write tools (founder)

- **`register_startup`** — `registry.registerStartup{value: collateralAmount}(name, description, commitmentPeriod, collateralAmount, tokenAllocForInvestors, minTokenPrice)`, role `founder`. Parses the `StartupRegistered` event from the receipt to extract the assigned `startupId`.
- **`deposit_extra_collateral`** — `vault.deposit(startupId){value: amount}`, role `founder`. (For topping up after registration.)

**Delete `buyback_token`**. The function does not exist on the real contract. Buyback is automatic in the fee distribution flow. Document the deletion in the report.

### `tools/investor.ts` write tools

- **`file_claim`** — `vault.fileClaim(startupId, amount, upstream, reasoningCID, slashEvidenceHash)`, role `investor`.
- (Funding via PositionManager is in `FUTURE WORK`.)

### `tools/oracle.ts` (NEW FILE — adoption scorer oracle)

This is the **distinguishing feature** of the Catalyst MCP vs Lockstep. The off-chain adoption scorer service (prompt 014) is the production implementation, but having a manual MCP tool lets a human or LLM agent post scores ad-hoc for testing, training data, or override scenarios.

```ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAdoptionScorerAs } from "../blockchain/contracts.js";

const VERDICT_MAP = { PENDING: 0, APPROVE: 1, DENY: 2 } as const;

export function registerOracleTools(server: McpServer): void {
  server.tool(
    "post_adoption_score",
    "Post an adoption verdict for a startup. Requires ORACLE_PRIVATE_KEY in env. Verdicts: PENDING | APPROVE | DENY. ReasoningCID is an IPFS CID (or any bytes32) pointing to the rationale document.",
    {
      startup_id: z.number().int().positive(),
      verdict: z.enum(["PENDING", "APPROVE", "DENY"]),
      confidence: z.number().int().min(0).max(100).describe("Confidence percentage 0-100"),
      reasoning_cid: z.string().describe("32-byte hex string (0x-prefixed) representing the IPFS CID or rationale hash"),
    },
    async ({ startup_id, verdict, confidence, reasoning_cid }) => {
      try {
        // Validate reasoning_cid is a valid bytes32
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
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              startup_id,
              verdict,
              confidence,
              reasoning_cid,
              tx_hash: tx.hash,
              block_number: receipt?.blockNumber,
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: false,
              error: err instanceof Error ? err.message : String(err),
            }),
          }],
          isError: true,
        };
      }
    },
  );
}
```

Register it in `index.ts`:

```ts
import { registerOracleTools } from "./tools/oracle.js";
// ...
registerOracleTools(server);
```

### `tools/admin.ts` (NEW FILE)

- `slash_evaluator` — `evalRegistry.slashEvaluator(...)`, role `admin`
- `register_evaluator` — `evalRegistry.registerEvaluator(...){value: stake}`, role `admin`
- `withdraw_evaluator_stake` — `evalRegistry.withdraw(...)`, role `admin`
- `set_min_stake` — `evalRegistry.setMinStake(...)`, role `admin`
- `set_oracle` — `adoptionScorer.setOracle(newOracle)`, role `admin` (for rotating the oracle EOA from the deployer to a dedicated service address)
- `evaluate_job` — `evaluator.evaluate(jobId)`, role `admin` (force-evaluation for testing; production uses an off-chain keeper)
- `update_status` — `registry.updateStatus(...)`, role `admin` (admin override of startup status)

Register `registerAdminTools(server)` in `index.ts`.

## Cambio 6 — Resources

The current `resources/protocol-stats.ts` and `resources/fee-schedule.ts` serve hardcoded data. Two options:

1. **Rewrite both** to read live from chain. `protocol-stats` becomes the same logic as the `get_protocol_stats` tool but exposed as a resource. `fee-schedule` reads the actual fee config from the hook (`microFeeBps`, treasury address, etc.).
2. **Delete both** and remove the registrations from `index.ts`. Resources are mostly redundant with tools in this server.

Pick option 1 if the resources were ever used; pick option 2 if not. Document the decision in the report.

## Cambio 7 — `.env.example`

Create or update `server/.env.example`:

```
# RPC + addresses
RPC_URL=https://sepolia.base.org
CATALYST_REGISTRY_ADDRESS=
CATALYST_HOOK_ADDRESS=
CATALYST_EVALUATOR_ADDRESS=
CATALYST_VAULT_ADDRESS=
CATALYST_EVAL_REGISTRY_ADDRESS=
CATALYST_ADOPTION_SCORER_ADDRESS=

# Optional: backend API for fast aggregated reads
BACKEND_URL=http://localhost:4700

# Per-actor signing keys (set only the ones you need)
FOUNDER_PRIVATE_KEY=
INVESTOR_PRIVATE_KEY=
ORACLE_PRIVATE_KEY=
ADMIN_PRIVATE_KEY=

# Fallback key used by any role when the specific one above is not set
MCP_PRIVATE_KEY=
```

If `server/.env` already exists, leave its values intact and only add missing keys.

## Cambio 8 — Build & verify

```bash
cd server
npm run build
```

Build clean. No corras `node dist/index.js` desde el prompt.

## Reportar al terminar

1. Files deleted (especially `data-store.ts` and `buyback_token`).
2. Files created / modified (note `tools/oracle.ts` and `tools/admin.ts` as new).
3. List of read tools, with which contract/method each one calls.
4. List of write tools, grouped by actor role.
5. Decision on resources: rewrote them to read live, or deleted them.
6. Confirm the ABIs in `blockchain/contracts.ts` match `../catalyst/packages/backend/src/abi/`.
7. Confirm `npm run build` passes.
8. **FUTURE WORK** with: real adoption scoring service (next prompt 014), funding tools requiring PositionManager, automated keeper that calls `evaluate_job` periodically, MCP-side event subscriptions (handled by backend indexer instead).
