import { ethers } from "ethers";
import { getConfig } from "../config.js";

// Minimal ABI stubs — will be expanded when contract ABIs are finalized
const REGISTRY_ABI = [
  "function getProposal(uint256 id) view returns (tuple(uint256 id, uint8 track, string name, string description, uint8 status, uint256 capitalSeeking, uint256 capitalFunded, uint256 collateral, uint256 commitmentPeriod, address tokenAddress, address pool1, address pool2, address owner, uint256 createdAt))",
  "function proposalCount() view returns (uint256)",
  "function fund(uint256 proposalId, uint256 amount, address token)",
  "function withdraw(uint256 proposalId, uint256 amount)",
  "function getInvestorPositions(address investor) view returns (uint256[])",
  "event ProposalCreated(uint256 indexed id, address indexed owner, uint8 track)",
  "event ProposalFunded(uint256 indexed id, address indexed investor, uint256 amount)",
  "event LiquidityWithdrawn(uint256 indexed id, address indexed investor, uint256 amount)",
] as const;

let provider: ethers.JsonRpcProvider | null = null;
let registry: ethers.Contract | null = null;

export function getProvider(): ethers.JsonRpcProvider {
  if (!provider) {
    const config = getConfig();
    provider = new ethers.JsonRpcProvider(config.rpcUrl);
  }
  return provider;
}

export function getRegistry(): ethers.Contract | null {
  const config = getConfig();
  if (!config.registryAddress) return null;
  if (!registry) {
    registry = new ethers.Contract(
      config.registryAddress,
      REGISTRY_ABI,
      getProvider(),
    );
  }
  return registry;
}

export function getSignedRegistry(
  signer: ethers.Signer,
): ethers.Contract | null {
  const config = getConfig();
  if (!config.registryAddress) return null;
  return new ethers.Contract(config.registryAddress, REGISTRY_ABI, signer);
}
