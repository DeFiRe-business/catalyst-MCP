/**
 * In-memory data store with seed data for development.
 * Will be replaced by on-chain reads once contracts are deployed.
 */
import type {
  Proposal,
  StartupProposal,
  TradingProposal,
  InvestorPosition,
  ProtocolStats,
  LeaderboardEntry,
  StartupStatus,
  AgentStatus,
  PnlSnapshot,
  OpenPosition,
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

const tradingProposals: TradingProposal[] = [
  {
    id: "prop_002",
    track: "trading",
    name: "AlphaVault v2",
    description: "Mean-reversion strategy on ETH/USDC",
    status: "active",
    capital_required: 50000,
    capital_funded: 50000,
    collateral: 5000,
    collateral_ratio: "10%",
    commitment_period_days: 30,
    min_return_bps: 200,
    profit_split: { investor: 70, agent: 20, protocol: 10 },
    agent_tier: 3,
    agent_address: "0x7a3f000000000000000000000000000000e92b00",
    owner: "0xbbbb000000000000000000000000000000000001",
    created_at: "2026-03-28T00:00:00Z",
  },
  {
    id: "prop_004",
    track: "trading",
    name: "MomentumBot",
    description: "Trend-following strategy on WBTC/USDC with volatility filters",
    status: "funding",
    capital_required: 100000,
    capital_funded: 35000,
    collateral: 10000,
    collateral_ratio: "10%",
    commitment_period_days: 60,
    min_return_bps: 300,
    profit_split: { investor: 65, agent: 25, protocol: 10 },
    agent_tier: 2,
    agent_address: "0xcccc000000000000000000000000000000000001",
    owner: "0xbbbb000000000000000000000000000000000002",
    created_at: "2026-04-02T00:00:00Z",
  },
  {
    id: "prop_006",
    track: "trading",
    name: "ArbSeeker",
    description: "Cross-pool arbitrage on correlated pairs",
    status: "funding",
    capital_required: 75000,
    capital_funded: 60000,
    collateral: 7500,
    collateral_ratio: "10%",
    commitment_period_days: 14,
    min_return_bps: 150,
    profit_split: { investor: 75, agent: 15, protocol: 10 },
    agent_tier: 4,
    agent_address: "0xdddd000000000000000000000000000000000001",
    owner: "0xbbbb000000000000000000000000000000000003",
    created_at: "2026-04-04T00:00:00Z",
  },
];

// --- Seed investor positions ---

const investorPositions: Map<string, InvestorPosition[]> = new Map([
  [
    "default",
    [
      {
        proposal_id: "prop_001",
        track: "startup",
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
        proposal_id: "prop_002",
        track: "trading",
        proposal_name: "AlphaVault v2",
        amount_invested: 15000,
        current_value: 15450,
        pnl: 450,
        pnl_pct: "+3.0%",
        tokens_allocated: 0,
        commitment_deadline: "2026-04-27T00:00:00Z",
        status: "active",
      },
    ],
  ],
]);

// --- Leaderboard seed ---

const leaderboard: LeaderboardEntry[] = [
  { rank: 1, agent_id: "prop_006", name: "ArbSeeker", return_pct: "18.4%", sharpe_ratio: 2.8, capital_managed: 75000, completed_cycles: 12, tier: 4 },
  { rank: 2, agent_id: "prop_002", name: "AlphaVault v2", return_pct: "12.1%", sharpe_ratio: 2.1, capital_managed: 50000, completed_cycles: 8, tier: 3 },
  { rank: 3, agent_id: "prop_004", name: "MomentumBot", return_pct: "9.7%", sharpe_ratio: 1.6, capital_managed: 100000, completed_cycles: 3, tier: 2 },
];

// --- Public API ---

export function getAllProposals(): Proposal[] {
  return [...startupProposals, ...tradingProposals];
}

export function getProposalById(id: string): Proposal | undefined {
  return getAllProposals().find((p) => p.id === id);
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

  if (proposal.track === "startup") {
    (proposal as StartupProposal).capital_funded += amount;
  } else {
    (proposal as TradingProposal).capital_funded += amount;
  }

  const positions = investorPositions.get(wallet) ?? [];
  positions.push({
    proposal_id: proposalId,
    track: proposal.track,
    proposal_name: proposal.name,
    amount_invested: amount,
    current_value: amount,
    pnl: 0,
    pnl_pct: "0%",
    tokens_allocated: 0,
    commitment_deadline: new Date(
      Date.now() +
        (proposal.track === "startup"
          ? (proposal as StartupProposal).commitment_period_days
          : (proposal as TradingProposal).commitment_period_days) *
          86400000,
    ).toISOString(),
    status: proposal.status,
  });
  investorPositions.set(wallet, positions);

  const txHash =
    "0x" +
    Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join("");
  return { success: true, tx_hash: txHash };
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

  const txHash =
    "0x" +
    Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join("");

  return {
    success: true,
    withdrawn: withdrawAmount,
    early_exit: earlyExit,
    penalty_applied: earlyExit,
    tx_hash: txHash,
  };
}

export function getProtocolStats(): ProtocolStats {
  const proposals = getAllProposals();
  const tvl = proposals.reduce((sum, p) => {
    const funded = p.track === "startup"
      ? (p as StartupProposal).capital_funded
      : (p as TradingProposal).capital_funded;
    return sum + funded;
  }, 0);

  return {
    total_tvl: tvl,
    active_proposals: proposals.filter((p) => p.status === "active" || p.status === "funding").length,
    total_proposals: proposals.length,
    fees_distributed: 34250,
    avg_investor_return: "8.5%",
    total_agents: tradingProposals.length,
    total_startups: startupProposals.length,
    total_investors: 47,
  };
}

export function getLeaderboardData(
  _period: string,
  sortBy: string,
  limit: number,
): LeaderboardEntry[] {
  const sorted = [...leaderboard].sort((a, b) => {
    switch (sortBy) {
      case "sharpe":
        return b.sharpe_ratio - a.sharpe_ratio;
      case "capital":
        return b.capital_managed - a.capital_managed;
      case "cycles":
        return b.completed_cycles - a.completed_cycles;
      default:
        return parseFloat(b.return_pct) - parseFloat(a.return_pct);
    }
  });
  return sorted.slice(0, limit);
}

// ============================================================
// Phase 2: Startup + Trading Agent data operations
// ============================================================

let nextProposalId = 7;

const pnlSnapshots: Map<string, PnlSnapshot[]> = new Map();
const startupFees: Map<string, number> = new Map([
  ["prop_001", 1250],
  ["prop_003", 8400],
  ["prop_005", 320],
]);
const agentBalances: Map<string, number> = new Map([
  ["prop_002", 51500],
  ["prop_004", 35000],
  ["prop_006", 62400],
]);

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

// --- Startup operations ---

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

// --- Trading agent operations ---

export function registerTradingAgentData(params: {
  name: string;
  strategy_description: string;
  capital_required: number;
  collateral_amount: number;
  commitment_period_days: number;
  min_return_bps: number;
  profit_split_investor_bps: number;
  owner: string;
}): { success: boolean; agent_id: string; tx_hash: string } {
  const id = `prop_${String(nextProposalId++).padStart(3, "0")}`;
  const agentBps = 10000 - params.profit_split_investor_bps - 1000; // protocol gets 10%
  const ratio = ((params.collateral_amount / params.capital_required) * 100).toFixed(2) + "%";

  const proposal: TradingProposal = {
    id,
    track: "trading",
    name: params.name,
    description: params.strategy_description,
    status: "funding",
    capital_required: params.capital_required,
    capital_funded: 0,
    collateral: params.collateral_amount,
    collateral_ratio: ratio,
    commitment_period_days: params.commitment_period_days,
    min_return_bps: params.min_return_bps,
    profit_split: {
      investor: params.profit_split_investor_bps / 100,
      agent: agentBps / 100,
      protocol: 10,
    },
    agent_tier: 1,
    agent_address: params.owner,
    owner: params.owner,
    created_at: new Date().toISOString(),
  };

  tradingProposals.push(proposal);
  agentBalances.set(id, 0);

  return { success: true, agent_id: id, tx_hash: makeTxHash() };
}

export function getAgentStatus(agentId: string): AgentStatus | null {
  const proposal = tradingProposals.find((p) => p.id === agentId);
  if (!proposal) return null;

  const balance = agentBalances.get(agentId) ?? proposal.capital_funded;
  const pnl = balance - proposal.capital_funded;
  const snapshots = pnlSnapshots.get(agentId);
  const lastReport = snapshots && snapshots.length > 0
    ? snapshots[snapshots.length - 1].timestamp
    : null;

  return {
    agent_id: proposal.id,
    name: proposal.name,
    status: proposal.status,
    capital_required: proposal.capital_required,
    capital_funded: proposal.capital_funded,
    collateral: proposal.collateral,
    current_balance: balance,
    pnl,
    pnl_pct: proposal.capital_funded > 0
      ? (pnl / proposal.capital_funded * 100).toFixed(2) + "%"
      : "0%",
    fees_received: Math.round(balance * 0.003 * 100) / 100,
    tier: proposal.agent_tier,
    commitment_period_days: proposal.commitment_period_days,
    days_remaining: daysRemaining(proposal.created_at, proposal.commitment_period_days),
    last_pnl_report: lastReport,
    created_at: proposal.created_at,
  };
}

export function recordPnlSnapshot(
  agentId: string,
  currentBalance: number,
  openPositions: OpenPosition[],
): { success: boolean; snapshot_id: string; timestamp: string } {
  const proposal = tradingProposals.find((p) => p.id === agentId);
  if (!proposal) return { success: false, snapshot_id: "", timestamp: "" };

  agentBalances.set(agentId, currentBalance);

  const snapshot: PnlSnapshot = {
    agent_id: agentId,
    current_balance: currentBalance,
    open_positions: openPositions,
    timestamp: new Date().toISOString(),
  };

  const existing = pnlSnapshots.get(agentId) ?? [];
  existing.push(snapshot);
  pnlSnapshots.set(agentId, existing);

  return {
    success: true,
    snapshot_id: `snap_${agentId}_${existing.length}`,
    timestamp: snapshot.timestamp,
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

  const maxClaim = proposal.collateral * (pos.amount_invested / (proposal.track === "startup"
    ? (proposal as StartupProposal).capital_funded
    : (proposal as TradingProposal).capital_funded));
  const actual = Math.min(claimAmount, maxClaim);

  return {
    success: true,
    proposal_id: proposalId,
    claim_amount: Math.round(actual * 100) / 100,
    tx_hash: makeTxHash(),
    message: `Claimed ${Math.round(actual * 100) / 100} USDx from collateral (pro-rata share via ERC-8210)`,
  };
}
