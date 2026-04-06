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
