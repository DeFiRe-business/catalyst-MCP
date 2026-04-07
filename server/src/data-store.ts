/**
 * In-memory data store with seed data for development.
 * Will be replaced by on-chain reads once contracts are deployed.
 */
import type {
  Proposal,
  StartupProposal,
  InvestorPosition,
  ProtocolStats,
  LeaderboardEntry,
  StartupStatus,
  ClaimResult,
} from "./types.js";

// --- Seed proposals ---

const startupProposals: StartupProposal[] = [
  {
    id: "prop_001",
    track: "startup",
    name: "Neuron Analytics",
    description: "On-chain analytics platform for DeFi protocols",
    status: "funding",
    capital_seeking: 120000,
    capital_funded: 45000,
    collateral: 8500,
    collateral_ratio: "7.08%",
    commitment_period_days: 180,
    token_allocation_investors: "20%",
    token_address: "0x1111111111111111111111111111111111111111",
    pool1_address: "0x2222222222222222222222222222222222222222",
    pool2_address: "0x3333333333333333333333333333333333333333",
    owner: "0xaaaa000000000000000000000000000000000001",
    created_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "prop_003",
    track: "startup",
    name: "DeFi Shield",
    description: "Insurance protocol for smart contract exploits",
    status: "active",
    capital_seeking: 250000,
    capital_funded: 250000,
    collateral: 25000,
    collateral_ratio: "10%",
    commitment_period_days: 365,
    token_allocation_investors: "15%",
    token_address: "0x4444444444444444444444444444444444444444",
    pool1_address: "0x5555555555555555555555555555555555555555",
    pool2_address: "0x6666666666666666666666666666666666666666",
    owner: "0xaaaa000000000000000000000000000000000002",
    created_at: "2026-03-15T00:00:00Z",
  },
  {
    id: "prop_005",
    track: "startup",
    name: "YieldBridge",
    description: "Cross-chain yield aggregator with auto-compounding",
    status: "funding",
    capital_seeking: 80000,
    capital_funded: 12000,
    collateral: 6000,
    collateral_ratio: "7.5%",
    commitment_period_days: 120,
    token_allocation_investors: "25%",
    token_address: "0x7777777777777777777777777777777777777777",
    pool1_address: "0x8888888888888888888888888888888888888888",
    pool2_address: "0x9999999999999999999999999999999999999999",
    owner: "0xaaaa000000000000000000000000000000000003",
    created_at: "2026-04-03T00:00:00Z",
  },
];

// --- Seed investor positions ---

const investorPositions: Map<string, InvestorPosition[]> = new Map([
  [
    "default",
    [
      {
        proposal_id: "prop_001",
        proposal_name: "Neuron Analytics",
        amount_invested: 10000,
        current_value: 10250,
        pnl: 250,
        pnl_pct: "+2.5%",
        tokens_allocated: 2000,
        commitment_deadline: "2026-09-28T00:00:00Z",
        status: "funding",
      },
      {
        proposal_id: "prop_003",
        proposal_name: "DeFi Shield",
        amount_invested: 15000,
        current_value: 15450,
        pnl: 450,
        pnl_pct: "+3.0%",
        tokens_allocated: 3000,
        commitment_deadline: "2027-03-15T00:00:00Z",
        status: "active",
      },
    ],
  ],
]);

// --- Leaderboard seed (startup-focused) ---

const leaderboard: LeaderboardEntry[] = [
  { rank: 1, startup_id: "prop_003", name: "DeFi Shield", token_appreciation: "42.5%", pool2_volume: 185000, investor_count: 18, days_since_launch: 22 },
  { rank: 2, startup_id: "prop_001", name: "Neuron Analytics", token_appreciation: "15.3%", pool2_volume: 62000, investor_count: 9, days_since_launch: 5 },
  { rank: 3, startup_id: "prop_005", name: "YieldBridge", token_appreciation: "8.1%", pool2_volume: 24000, investor_count: 4, days_since_launch: 3 },
];

// --- Fee tracking ---

const startupFees: Map<string, number> = new Map([
  ["prop_001", 1250],
  ["prop_003", 8400],
  ["prop_005", 320],
]);

// --- Helpers ---

function makeTxHash(): string {
  return (
    "0x" +
    Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join("")
  );
}

function makeAddress(): string {
  return (
    "0x" +
    Array.from({ length: 40 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join("")
  );
}

function daysRemaining(createdAt: string, periodDays: number): number {
  const deadline = new Date(createdAt).getTime() + periodDays * 86400000;
  return Math.max(0, Math.ceil((deadline - Date.now()) / 86400000));
}

// --- Public API ---

export function getAllProposals(): Proposal[] {
  return [...startupProposals];
}

export function getProposalById(id: string): Proposal | undefined {
  return startupProposals.find((p) => p.id === id);
}

export function getPositionsForWallet(
  wallet: string,
): InvestorPosition[] {
  return investorPositions.get(wallet) ?? investorPositions.get("default") ?? [];
}

export function addFunding(
  proposalId: string,
  amount: number,
  wallet: string,
): { success: boolean; tx_hash: string } {
  const proposal = getProposalById(proposalId);
  if (!proposal) return { success: false, tx_hash: "" };

  proposal.capital_funded += amount;

  const positions = investorPositions.get(wallet) ?? [];
  positions.push({
    proposal_id: proposalId,
    proposal_name: proposal.name,
    amount_invested: amount,
    current_value: amount,
    pnl: 0,
    pnl_pct: "0%",
    tokens_allocated: 0,
    commitment_deadline: new Date(
      Date.now() + proposal.commitment_period_days * 86400000,
    ).toISOString(),
    status: proposal.status,
  });
  investorPositions.set(wallet, positions);

  return { success: true, tx_hash: makeTxHash() };
}

export function withdrawFromPosition(
  proposalId: string,
  amount: number,
  wallet: string,
): {
  success: boolean;
  withdrawn: number;
  early_exit: boolean;
  penalty_applied: boolean;
  tx_hash: string;
} {
  const positions = investorPositions.get(wallet) ?? investorPositions.get("default") ?? [];
  const pos = positions.find((p) => p.proposal_id === proposalId);
  if (!pos) {
    return { success: false, withdrawn: 0, early_exit: false, penalty_applied: false, tx_hash: "" };
  }

  const withdrawAmount = amount === 0 ? pos.current_value : Math.min(amount, pos.current_value);
  const earlyExit = new Date(pos.commitment_deadline) > new Date();

  pos.current_value -= withdrawAmount;
  pos.amount_invested -= withdrawAmount;

  return {
    success: true,
    withdrawn: withdrawAmount,
    early_exit: earlyExit,
    penalty_applied: earlyExit,
    tx_hash: makeTxHash(),
  };
}

export function getProtocolStats(): ProtocolStats {
  const tvl = startupProposals.reduce((sum, p) => sum + p.capital_funded, 0);

  return {
    total_tvl_pool1: tvl,
    total_pool2_volume: leaderboard.reduce((sum, e) => sum + e.pool2_volume, 0),
    startups_launched: startupProposals.length,
    tokens_protocol_holds: startupProposals.filter((p) => p.status === "active" || p.status === "completed").length,
    total_fees_distributed: 34250,
    avg_token_appreciation: "21.9%",
  };
}

export function getLeaderboardData(
  _period: string,
  sortBy: string,
  limit: number,
): LeaderboardEntry[] {
  const sorted = [...leaderboard].sort((a, b) => {
    switch (sortBy) {
      case "pool2_volume":
        return b.pool2_volume - a.pool2_volume;
      case "investor_count":
        return b.investor_count - a.investor_count;
      case "days_since_launch":
        return a.days_since_launch - b.days_since_launch;
      default: // token_appreciation
        return parseFloat(b.token_appreciation) - parseFloat(a.token_appreciation);
    }
  });
  return sorted.slice(0, limit);
}

// --- Startup operations ---

let nextProposalId = 7;

export function registerStartup(params: {
  name: string;
  description: string;
  capital_seeking: number;
  collateral_amount: number;
  commitment_period_days: number;
  token_name: string;
  token_symbol: string;
  token_allocation_investors?: number;
  min_token_price_target?: number;
  owner: string;
}): { success: boolean; startup_id: string; token_address: string; pool1_address: string; pool2_address: string; tx_hash: string } {
  const id = `prop_${String(nextProposalId++).padStart(3, "0")}`;
  const tokenAddress = makeAddress();
  const pool1 = makeAddress();
  const pool2 = makeAddress();
  const ratio = ((params.collateral_amount / params.capital_seeking) * 100).toFixed(2) + "%";

  const proposal: StartupProposal = {
    id,
    track: "startup",
    name: params.name,
    description: params.description,
    status: "funding",
    capital_seeking: params.capital_seeking,
    capital_funded: 0,
    collateral: params.collateral_amount,
    collateral_ratio: ratio,
    commitment_period_days: params.commitment_period_days,
    token_allocation_investors: (params.token_allocation_investors ?? 20) + "%",
    token_address: tokenAddress,
    pool1_address: pool1,
    pool2_address: pool2,
    owner: params.owner,
    created_at: new Date().toISOString(),
  };

  startupProposals.push(proposal);
  startupFees.set(id, 0);

  return {
    success: true,
    startup_id: id,
    token_address: tokenAddress,
    pool1_address: pool1,
    pool2_address: pool2,
    tx_hash: makeTxHash(),
  };
}

export function getStartupStatus(startupId: string): StartupStatus | null {
  const proposal = startupProposals.find((p) => p.id === startupId);
  if (!proposal) return null;

  return {
    startup_id: proposal.id,
    name: proposal.name,
    status: proposal.status,
    capital_seeking: proposal.capital_seeking,
    capital_funded: proposal.capital_funded,
    funding_progress: ((proposal.capital_funded / proposal.capital_seeking) * 100).toFixed(1) + "%",
    collateral: proposal.collateral,
    fees_received: startupFees.get(proposal.id) ?? 0,
    token_address: proposal.token_address,
    token_price_current: 0.10 + Math.random() * 0.5,
    investor_count: Math.max(1, Math.floor(proposal.capital_funded / 5000)),
    commitment_period_days: proposal.commitment_period_days,
    days_remaining: daysRemaining(proposal.created_at, proposal.commitment_period_days),
    created_at: proposal.created_at,
  };
}

export function buybackToken(
  startupId: string,
  amountUsdx: number,
  maxSlippageBps: number,
): { success: boolean; tokens_bought: number; avg_price: number; slippage_bps: number; tx_hash: string } {
  const proposal = startupProposals.find((p) => p.id === startupId);
  if (!proposal) return { success: false, tokens_bought: 0, avg_price: 0, slippage_bps: 0, tx_hash: "" };

  const tokenPrice = 0.10 + Math.random() * 0.5;
  const slippage = Math.floor(Math.random() * Math.min(maxSlippageBps, 50));
  const effectivePrice = tokenPrice * (1 + slippage / 10000);
  const tokensBought = amountUsdx / effectivePrice;

  return {
    success: true,
    tokens_bought: Math.round(tokensBought * 100) / 100,
    avg_price: Math.round(effectivePrice * 10000) / 10000,
    slippage_bps: slippage,
    tx_hash: makeTxHash(),
  };
}

// --- Claim operations ---

export function fileClaim(
  proposalId: string,
  claimAmount: number,
  wallet: string,
): ClaimResult {
  const proposal = getProposalById(proposalId);
  if (!proposal) {
    return { success: false, proposal_id: proposalId, claim_amount: 0, tx_hash: "", message: "Proposal not found" };
  }
  if (proposal.status !== "failed") {
    return { success: false, proposal_id: proposalId, claim_amount: 0, tx_hash: "", message: "Claims only available for failed proposals" };
  }

  const positions = getPositionsForWallet(wallet);
  const pos = positions.find((p) => p.proposal_id === proposalId);
  if (!pos) {
    return { success: false, proposal_id: proposalId, claim_amount: 0, tx_hash: "", message: "No position found for this proposal" };
  }

  const maxClaim = proposal.collateral * (pos.amount_invested / proposal.capital_funded);
  const actual = Math.min(claimAmount, maxClaim);

  return {
    success: true,
    proposal_id: proposalId,
    claim_amount: Math.round(actual * 100) / 100,
    tx_hash: makeTxHash(),
    message: `Claimed ${Math.round(actual * 100) / 100} USDx from collateral (pro-rata share via ERC-8210)`,
  };
}
