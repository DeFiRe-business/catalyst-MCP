/**
 * On-chain contract interaction layer for DeFiRe Catalyst.
 *
 * Two core contracts:
 *   CatalystRegistry — ERC-8183 based startup registry
 *   CatalystHook     — Uniswap v4 hook that manages investor positions,
 *                       token allocations, fee distribution, and ERC-8210 collateral
 *
 * When env vars are missing the getters return null, and the higher-level
 * code falls back to the in-memory data store.
 */
import { ethers } from "ethers";
import { getConfig, getProvider } from "../config.js";
import type {
  Proposal,
  StartupProposal,
  ProposalStatus,
} from "../types.js";

// ============================================================================
// ABI fragments — human-readable Solidity signatures
// ============================================================================

/**
 * CatalystRegistry (extends ERC-8183 Agentic Commerce Protocol)
 *
 * Structs returned from view functions use positional tuples; field order
 * matches the Solidity struct declaration.
 */
const REGISTRY_ABI = [
  // ---- Startup track ----
  "function registerStartup(string name, string description, uint256 capitalSeeking, uint256 collateral, uint256 commitmentPeriodDays, string tokenName, string tokenSymbol, uint256 tokenAllocationInvestorsBps) returns (uint256 jobId)",
  "function getStartup(uint256 jobId) view returns (tuple(uint256 id, string name, string description, uint8 status, uint256 capitalSeeking, uint256 capitalFunded, uint256 collateral, uint256 commitmentPeriodDays, uint256 tokenAllocationInvestorsBps, address tokenAddress, address pool1, address pool2, address owner, uint256 createdAt))",

  // ---- Shared ----
  "function jobCount() view returns (uint256)",
  "function fund(uint256 jobId, uint256 amount, address token) payable",
  "function withdraw(uint256 jobId, uint256 amount)",

  // ---- ERC-8210 Assurance ----
  "function getAssuranceAccount(address agent) view returns (tuple(uint256 totalFunded, uint256 availableAmount, uint256 lockedAmount, uint256 paidOutAmount))",
  "function fileClaim(uint256 jobId, uint256 requestedAmount, bytes evidence) returns (uint256 claimId)",

  // ---- Events ----
  "event StartupRegistered(uint256 indexed jobId, address indexed owner, string name)",
  "event JobFunded(uint256 indexed jobId, address indexed investor, uint256 amount)",
  "event JobCompleted(uint256 indexed jobId)",
  "event JobFailed(uint256 indexed jobId)",
  "event ClaimFiled(uint256 indexed jobId, address indexed claimant, uint256 amount)",
] as const;

/**
 * CatalystHook (Uniswap v4 hook — manages investor positions & token allocations)
 */
const HOOK_ABI = [
  // ---- Investor position tracking ----
  "function investorPositions(uint256 jobId, address investor) view returns (tuple(uint256 amountInvested, uint256 currentValue, uint256 tokensAllocated, uint256 commitmentDeadline, bool active))",
  "function tokenAllocations(uint256 jobId, address investor) view returns (uint256 amount)",

  // ---- Aggregated views ----
  "function totalInvestedInJob(uint256 jobId) view returns (uint256)",
  "function investorCountForJob(uint256 jobId) view returns (uint256)",

  // ---- Fee distribution ----
  "function claimFees(uint256 jobId) returns (uint256 amount)",
  "function accruedFees(uint256 jobId) view returns (uint256)",

  // ---- Token buyback helper ----
  "function buybackToken(uint256 jobId, uint256 amountUsdx, uint256 maxSlippageBps) returns (uint256 tokensBought)",

  // ---- Events ----
  "event PositionUpdated(uint256 indexed jobId, address indexed investor, uint256 amount)",
  "event TokensAllocated(uint256 indexed jobId, address indexed investor, uint256 tokens)",
  "event FeesDistributed(uint256 indexed jobId, uint256 amount)",
  "event BuybackExecuted(uint256 indexed jobId, uint256 usdxSpent, uint256 tokensBought)",
] as const;

// ============================================================================
// Contract instance singletons
// ============================================================================

let registry: ethers.Contract | null = null;
let hook: ethers.Contract | null = null;

export function getRegistry(): ethers.Contract | null {
  const { registryAddress } = getConfig();
  if (!registryAddress) return null;
  if (!registry) {
    registry = new ethers.Contract(registryAddress, REGISTRY_ABI, getProvider());
  }
  return registry;
}

export function getHook(): ethers.Contract | null {
  const { hookAddress } = getConfig();
  if (!hookAddress) return null;
  if (!hook) {
    hook = new ethers.Contract(hookAddress, HOOK_ABI, getProvider());
  }
  return hook;
}

/** Registry connected to a signer — needed for write transactions. */
export function getSignedRegistry(signer: ethers.Signer): ethers.Contract | null {
  const { registryAddress } = getConfig();
  if (!registryAddress) return null;
  return new ethers.Contract(registryAddress, REGISTRY_ABI, signer);
}

/** Hook connected to a signer — needed for write transactions. */
export function getSignedHook(signer: ethers.Signer): ethers.Contract | null {
  const { hookAddress } = getConfig();
  if (!hookAddress) return null;
  return new ethers.Contract(hookAddress, HOOK_ABI, signer);
}

// ============================================================================
// On-chain read helpers — return typed data or null when unconfigured
// ============================================================================

/** Status enum mapping from uint8 on-chain → our string type. */
const JOB_STATUS_MAP: Record<number, string> = {
  0: "funding",   // Open
  1: "funding",   // Funded (still accepting capital)
  2: "active",    // Submitted / in progress
  3: "completed", // Completed
  4: "failed",    // Rejected / Failed
  5: "failed",    // Expired
};

function mapStatus(raw: number): string {
  return JOB_STATUS_MAP[raw] ?? "funding";
}

// ---------------------------------------------------------------------------
// CatalystRegistry reads
// ---------------------------------------------------------------------------

export interface ChainStartup {
  id: bigint;
  name: string;
  description: string;
  status: string;
  capitalSeeking: bigint;
  capitalFunded: bigint;
  collateral: bigint;
  commitmentPeriodDays: bigint;
  tokenAllocationInvestorsBps: bigint;
  tokenAddress: string;
  pool1: string;
  pool2: string;
  owner: string;
  createdAt: bigint;
}

/**
 * Read a startup record directly from the CatalystRegistry contract.
 * Returns null when on-chain config is missing or the call reverts.
 */
export async function getStartupFromChain(
  jobId: number | bigint,
): Promise<ChainStartup | null> {
  const reg = getRegistry();
  if (!reg) return null;

  try {
    const raw = await reg.getStartup(jobId);
    return {
      id: raw[0],
      name: raw[1],
      description: raw[2],
      status: mapStatus(Number(raw[3])),
      capitalSeeking: raw[4],
      capitalFunded: raw[5],
      collateral: raw[6],
      commitmentPeriodDays: raw[7],
      tokenAllocationInvestorsBps: raw[8],
      tokenAddress: raw[9],
      pool1: raw[10],
      pool2: raw[11],
      owner: raw[12],
      createdAt: raw[13],
    };
  } catch (err) {
    console.error(`[contracts] getStartupFromChain(${jobId}) failed:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// CatalystHook reads
// ---------------------------------------------------------------------------

export interface ChainInvestorPosition {
  amountInvested: bigint;
  currentValue: bigint;
  tokensAllocated: bigint;
  commitmentDeadline: bigint;
  active: boolean;
}

/**
 * Read a single investor's position for a given job from the CatalystHook.
 */
export async function getInvestorPosition(
  jobId: number | bigint,
  investor: string,
): Promise<ChainInvestorPosition | null> {
  const h = getHook();
  if (!h) return null;

  try {
    const raw = await h.investorPositions(jobId, investor);
    return {
      amountInvested: raw[0],
      currentValue: raw[1],
      tokensAllocated: raw[2],
      commitmentDeadline: raw[3],
      active: raw[4],
    };
  } catch (err) {
    console.error(`[contracts] getInvestorPosition(${jobId}, ${investor}) failed:`, err);
    return null;
  }
}

/**
 * Read the token allocation for a specific investor in a given job.
 */
export async function getTokenAllocation(
  jobId: number | bigint,
  investor: string,
): Promise<bigint | null> {
  const h = getHook();
  if (!h) return null;

  try {
    return await h.tokenAllocations(jobId, investor);
  } catch (err) {
    console.error(`[contracts] getTokenAllocation(${jobId}, ${investor}) failed:`, err);
    return null;
  }
}

/**
 * Read the total amount invested in a job.
 */
export async function getTotalInvestedInJob(
  jobId: number | bigint,
): Promise<bigint | null> {
  const h = getHook();
  if (!h) return null;

  try {
    return await h.totalInvestedInJob(jobId);
  } catch (err) {
    console.error(`[contracts] getTotalInvestedInJob(${jobId}) failed:`, err);
    return null;
  }
}

/**
 * Read how many investors have funded a job.
 */
export async function getInvestorCountForJob(
  jobId: number | bigint,
): Promise<number | null> {
  const h = getHook();
  if (!h) return null;

  try {
    const count = await h.investorCountForJob(jobId);
    return Number(count);
  } catch (err) {
    console.error(`[contracts] getInvestorCountForJob(${jobId}) failed:`, err);
    return null;
  }
}

/**
 * Read accrued (unclaimed) fees for a job.
 */
export async function getAccruedFees(
  jobId: number | bigint,
): Promise<bigint | null> {
  const h = getHook();
  if (!h) return null;

  try {
    return await h.accruedFees(jobId);
  } catch (err) {
    console.error(`[contracts] getAccruedFees(${jobId}) failed:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// ERC-8210 Assurance Account reads
// ---------------------------------------------------------------------------

export interface AssuranceAccount {
  totalFunded: bigint;
  availableAmount: bigint;
  lockedAmount: bigint;
  paidOutAmount: bigint;
}

/**
 * Read the ERC-8210 assurance account for a startup.
 */
export async function getAssuranceAccount(
  agent: string,
): Promise<AssuranceAccount | null> {
  const reg = getRegistry();
  if (!reg) return null;

  try {
    const raw = await reg.getAssuranceAccount(agent);
    return {
      totalFunded: raw[0],
      availableAmount: raw[1],
      lockedAmount: raw[2],
      paidOutAmount: raw[3],
    };
  } catch (err) {
    console.error(`[contracts] getAssuranceAccount(${agent}) failed:`, err);
    return null;
  }
}

// ============================================================================
// Chain → Proposal converter  (used by tool layers for on-chain fallback)
// ============================================================================

const USDX_DECIMALS = 6;

function fromChainAmount(value: bigint): number {
  return Number(value) / 10 ** USDX_DECIMALS;
}

function extractJobId(proposalId: string): number | null {
  const match = proposalId.match(/^prop_(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

function chainStartupToProposal(
  chain: ChainStartup,
  proposalId: string,
): StartupProposal {
  const capitalSeeking = fromChainAmount(chain.capitalSeeking);
  const capitalFunded = fromChainAmount(chain.capitalFunded);
  const collateral = fromChainAmount(chain.collateral);

  return {
    id: proposalId,
    track: "startup",
    name: chain.name,
    description: chain.description,
    status: chain.status as ProposalStatus,
    capital_seeking: capitalSeeking,
    capital_funded: capitalFunded,
    collateral,
    collateral_ratio:
      capitalSeeking > 0
        ? ((collateral / capitalSeeking) * 100).toFixed(2) + "%"
        : "0%",
    commitment_period_days: Number(chain.commitmentPeriodDays),
    token_allocation_investors:
      (Number(chain.tokenAllocationInvestorsBps) / 100).toFixed(0) + "%",
    token_address: chain.tokenAddress,
    pool1_address: chain.pool1,
    pool2_address: chain.pool2,
    owner: chain.owner,
    created_at: new Date(Number(chain.createdAt) * 1000).toISOString(),
  };
}

/**
 * Try to resolve a proposal from on-chain data.
 * Returns undefined when contracts are not configured or the job doesn't exist.
 * Callers should fall back to the in-memory data-store when this returns undefined.
 */
export async function resolveProposalFromChain(
  proposalId: string,
): Promise<Proposal | undefined> {
  const jobId = extractJobId(proposalId);
  if (jobId === null) return undefined;

  const startup = await getStartupFromChain(jobId);
  if (startup) return chainStartupToProposal(startup, proposalId);

  return undefined;
}
