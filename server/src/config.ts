import { ethers } from "ethers";

// ---------------------------------------------------------------------------
// Network configuration — read from environment variables
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Shared provider singleton
// ---------------------------------------------------------------------------

let providerInstance: ethers.JsonRpcProvider | null = null;

export function getProvider(): ethers.JsonRpcProvider {
  if (!providerInstance) {
    providerInstance = new ethers.JsonRpcProvider(getConfig().rpcUrl);
  }
  return providerInstance;
}

// ---------------------------------------------------------------------------
// Per-actor signers
// ---------------------------------------------------------------------------

const ENV_KEY_BY_ROLE: Record<ActorRole, string> = {
  founder: "FOUNDER_PRIVATE_KEY",
  investor: "INVESTOR_PRIVATE_KEY",
  oracle: "ORACLE_PRIVATE_KEY",
  admin: "ADMIN_PRIVATE_KEY",
  default: "MCP_PRIVATE_KEY",
};

const walletCache = new Map<ActorRole, ethers.Wallet>();

/**
 * Returns an ethers.Wallet for the requested actor role.
 * Lazily reads the corresponding env var. Falls back to MCP_PRIVATE_KEY when
 * the role-specific key is not set. Throws if no key is configured.
 *
 * The MCP can run read-only without any private keys configured — this only
 * fires when a write tool is invoked.
 */
export function getSigner(role: ActorRole): ethers.Wallet {
  const cached = walletCache.get(role);
  if (cached) return cached;

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
