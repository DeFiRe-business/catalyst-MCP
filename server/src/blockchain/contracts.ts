import { ethers } from "ethers";
import { getConfig, getProvider, getSigner, type ActorRole } from "../config.js";

// ============================================================================
// ABI fragments — human-readable Solidity signatures.
//
// Read-only views are copied verbatim from
// `../catalyst/packages/backend/src/abi/`.
// Write-method signatures are taken directly from the contract sources in
// `../catalyst/packages/contracts/src/`.
// ============================================================================

const REGISTRY_ABI = [
  // Reads
  "function getStartup(uint256 startupId) view returns (tuple(address owner, string name, string description, address token, address pool1, address pool2, uint256 collateral, uint256 commitmentDeadline, uint256 totalFunding, uint8 status, uint256 minTokenPrice))",
  "function investorTokenAllocation(uint256) view returns (uint256)",
  // Writes
  "function registerStartup(string name, string description, uint256 commitmentPeriod, uint256 collateralAmount, uint256 tokenAllocForInvestors, uint256 minTokenPrice) payable returns (uint256)",
  "function updateStatus(uint256 id, uint8 newStatus)",
  "function setPoolAddresses(uint256 startupId, address pool1, address pool2)",
  // Events
  "event StartupRegistered(uint256 indexed startupId, address indexed owner, string name, address token)",
  "event StatusUpdated(uint256 indexed id, uint8 newStatus)",
  "event PoolAddressesSet(uint256 indexed startupId, address pool1, address pool2)",
] as const;

const HOOK_ABI = [
  "function getInvestors(uint256 jobId) view returns (address[])",
  "function getInvestorCount(uint256 jobId) view returns (uint256)",
  "function investorPositions(uint256 jobId, address investor) view returns (uint256)",
  "function tokenAllocations(uint256 jobId, address investor) view returns (uint256)",
  "function totalJobLiquidity(uint256 jobId) view returns (uint256)",
  "function getTokenPriceInStables(uint256 jobId) view returns (uint256)",
  "event InvestorFunded(address indexed sender, uint256 indexed jobId, uint256 amount)",
  "event EarlyExit(address indexed sender, uint256 indexed jobId, uint256 tokensForfeited)",
  "event BuybackTriggered(uint256 indexed jobId, uint256 buybackAmount)",
  "event FeeDistributed(uint256 indexed jobId, uint256 operationalAmount, address indexed jobOwner)",
  "event ProtocolFeeCollected(uint256 indexed jobId, uint256 protocolFee, address indexed protocolTreasury)",
  "event TokensRedistributed(uint256 indexed jobId, uint256 tokensRedistributed, uint256 investorCount)",
] as const;

const EVALUATOR_ABI = [
  "function finalReasoningCID(uint256) view returns (bytes32)",
  "function finalTokenPrice(uint256) view returns (uint256)",
  "function evaluate(uint256 jobId)",
  "event JobEvaluated(uint256 indexed jobId, bool success)",
] as const;

const VAULT_ABI = [
  "function deposits(uint256) view returns (address owner, uint256 amount, uint256 jobId, bool locked, bool claimed)",
  "function claims(uint256 jobId, address investor) view returns (uint256 jobId, address claimant, uint256 amount, bytes32 upstream, bytes32 reasoningCID, bytes32 slashEvidenceHash, uint256 timestamp)",
  "function claimedFromJob(uint256 jobId) view returns (uint256)",
  "function deposit(uint256 jobId) payable returns (uint256)",
  "function fileClaim(uint256 jobId, uint256 amount, bytes32 upstream, bytes32 reasoningCID, bytes32 slashEvidenceHash)",
  "event CollateralDeposited(uint256 indexed depositId, address indexed owner, uint256 amount, uint256 jobId)",
  "event CollateralReleased(uint256 indexed depositId, address indexed to, uint256 amount)",
  "event ClaimFiled(uint256 indexed jobId, address indexed investor, uint256 amount, bytes32 upstream, bytes32 reasoningCID, bytes32 slashEvidenceHash)",
] as const;

const EVAL_REGISTRY_ABI = [
  "function getEvaluator(address evaluator) view returns (tuple(uint256 stake, bool active, uint256 registeredAt))",
  "function getSlashRecord(uint256 jobId) view returns (tuple(address evaluator, uint256 jobId, uint256 slashedAmount, bytes32 reason, uint256 timestamp))",
  "function buildEvidenceHash(uint256 jobId) view returns (bytes32)",
  "function minStake() view returns (uint256)",
  "function totalSlashedFunds() view returns (uint256)",
  "function slashCount() view returns (uint256)",
  "function registerEvaluator(address evaluator) payable",
  "function withdraw(address evaluator, uint256 amount)",
  "function slashEvaluator(address evaluator, uint256 jobId, uint256 slashedAmount, bytes32 reason)",
  "function setMinStake(uint256 _minStake)",
  "event EvaluatorRegistered(address indexed evaluator, uint256 stake)",
  "event EvaluatorStakeIncreased(address indexed evaluator, uint256 added, uint256 newTotal)",
  "event EvaluatorSlashed(address indexed evaluator, uint256 indexed jobId, uint256 slashedAmount, bytes32 reason)",
  "event EvaluatorWithdrawn(address indexed evaluator, uint256 amount, uint256 remainingStake)",
  "event MinStakeUpdated(uint256 oldMinStake, uint256 newMinStake)",
] as const;

const ADOPTION_SCORER_ABI = [
  "function getScore(uint256 jobId) view returns (tuple(uint8 verdict, uint8 confidence, bytes32 reasoningCID, uint256 timestamp))",
  "function oracle() view returns (address)",
  "function postScore(uint256 jobId, uint8 verdict, uint8 confidence, bytes32 reasoningCID)",
  "function setOracle(address _oracle)",
  "event ScorePosted(uint256 indexed jobId, uint8 verdict, uint8 confidence, bytes32 reasoningCID)",
  "event OracleUpdated(address indexed oldOracle, address indexed newOracle)",
] as const;

// ============================================================================
// Read-only contract instances (provider-bound)
// ============================================================================

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

// ============================================================================
// Signer-bound instances (write transactions)
// ============================================================================

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

// ============================================================================
// Shared helpers
// ============================================================================

export const STATUS_NAMES = ["funding", "active", "completed", "failed"] as const;
export type StartupStatusName = (typeof STATUS_NAMES)[number];

export function statusName(raw: number): StartupStatusName {
  return STATUS_NAMES[raw] ?? "funding";
}

export const VERDICT_NAMES = ["PENDING", "APPROVE", "DENY"] as const;
export type VerdictName = (typeof VERDICT_NAMES)[number];

export function verdictName(raw: number): VerdictName {
  return VERDICT_NAMES[raw] ?? "PENDING";
}

/**
 * Recursively serializes any bigint values inside a value to decimal strings,
 * leaving everything else untouched. Useful for tool responses since JSON
 * cannot encode bigints natively.
 */
export function serializeBigints<T>(value: T): T {
  if (typeof value === "bigint") {
    return value.toString() as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => serializeBigints(v)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = serializeBigints(v);
    }
    return out as T;
  }
  return value;
}

/**
 * Decodes a `getStartup(id)` tuple into a typed object with bigints intact.
 * The tuple order matches `ICatalystRegistry.StartupInfo`.
 */
export interface StartupInfo {
  owner: string;
  name: string;
  description: string;
  token: string;
  pool1: string;
  pool2: string;
  collateral: bigint;
  commitmentDeadline: bigint;
  totalFunding: bigint;
  status: number;
  minTokenPrice: bigint;
}

export function decodeStartup(raw: ethers.Result | StartupInfo): StartupInfo {
  // ethers v6 returns tuple results as Result with both indexed and named access.
  const r = raw as unknown as Record<string | number, unknown>;
  return {
    owner: String(r.owner ?? r[0]),
    name: String(r.name ?? r[1]),
    description: String(r.description ?? r[2]),
    token: String(r.token ?? r[3]),
    pool1: String(r.pool1 ?? r[4]),
    pool2: String(r.pool2 ?? r[5]),
    collateral: BigInt((r.collateral ?? r[6]) as bigint | string | number),
    commitmentDeadline: BigInt((r.commitmentDeadline ?? r[7]) as bigint | string | number),
    totalFunding: BigInt((r.totalFunding ?? r[8]) as bigint | string | number),
    status: Number(r.status ?? r[9]),
    minTokenPrice: BigInt((r.minTokenPrice ?? r[10]) as bigint | string | number),
  };
}

export interface ScoreInfo {
  verdict: number;
  confidence: number;
  reasoningCID: string;
  timestamp: bigint;
}

export function decodeScore(raw: ethers.Result | ScoreInfo): ScoreInfo {
  const r = raw as unknown as Record<string | number, unknown>;
  return {
    verdict: Number(r.verdict ?? r[0]),
    confidence: Number(r.confidence ?? r[1]),
    reasoningCID: String(r.reasoningCID ?? r[2]),
    timestamp: BigInt((r.timestamp ?? r[3]) as bigint | string | number),
  };
}
