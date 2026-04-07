import { ethers } from "ethers";

// ---------------------------------------------------------------------------
// Network configuration — read from environment variables
// ---------------------------------------------------------------------------

export interface NetworkConfig {
  chainId: number;
  rpcUrl: string;
  registryAddress: string;
  hookAddress: string;
}

export function getConfig(): NetworkConfig {
  return {
    chainId: Number(process.env.CHAIN_ID ?? 84532),
    rpcUrl: process.env.RPC_URL ?? "https://sepolia.base.org",
    registryAddress: process.env.REGISTRY_ADDRESS ?? "",
    hookAddress: process.env.HOOK_ADDRESS ?? "",
  };
}

// ---------------------------------------------------------------------------
// Shared provider singleton
// ---------------------------------------------------------------------------

let provider: ethers.JsonRpcProvider | null = null;

/**
 * Returns a shared JsonRpcProvider pointed at the configured RPC URL.
 * The instance is lazily created and reused across the process.
 */
export function getProvider(): ethers.JsonRpcProvider {
  if (!provider) {
    const config = getConfig();
    provider = new ethers.JsonRpcProvider(config.rpcUrl, config.chainId);
  }
  return provider;
}

/**
 * Returns true when REGISTRY_ADDRESS and HOOK_ADDRESS are both set,
 * meaning on-chain reads should work.
 */
export function isOnChainConfigured(): boolean {
  const config = getConfig();
  return config.registryAddress !== "" && config.hookAddress !== "";
}
