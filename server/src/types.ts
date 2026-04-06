export type Track = "startup" | "trading";
export type ProposalStatus = "funding" | "active" | "completed" | "failed";

export interface ProfitSplit {
  investor: number;
  agent: number;
  protocol: number;
}

export interface StartupProposal {
  id: string;
  track: "startup";
  name: string;
  description: string;
  status: ProposalStatus;
  capital_seeking: number;
  capital_funded: number;
  collateral: number;
  collateral_ratio: string;
  commitment_period_days: number;
  token_allocation_investors: string;
  token_address: string;
  pool1_address: string;
  pool2_address: string;
  owner: string;
  created_at: string;
}

export interface TradingProposal {
  id: string;
  track: "trading";
  name: string;
  description: string;
  status: ProposalStatus;
  capital_required: number;
  capital_funded: number;
  collateral: number;
  collateral_ratio: string;
  commitment_period_days: number;
  min_return_bps: number;
  profit_split: ProfitSplit;
  agent_tier: number;
  agent_address: string;
  owner: string;
  created_at: string;
}

export type Proposal = StartupProposal | TradingProposal;

export interface InvestorPosition {
  proposal_id: string;
  track: Track;
  proposal_name: string;
  amount_invested: number;
  current_value: number;
  pnl: number;
  pnl_pct: string;
  tokens_allocated: number;
  commitment_deadline: string;
  status: ProposalStatus;
}

export interface EvaluationResult {
  proposal_id: string;
  investment_amount: number;
  estimated_daily_fees_usd: number;
  estimated_monthly_fees_usd: number;
  pool_volume_24h: number;
  pool_apy_current: string;
  collateral_coverage: string;
  risk_score: "low" | "medium" | "high";
  similar_proposals_avg_return: string;
  breakeven_days: number;
}

export interface ProtocolStats {
  total_tvl: number;
  active_proposals: number;
  total_proposals: number;
  fees_distributed: number;
  avg_investor_return: string;
  total_agents: number;
  total_startups: number;
  total_investors: number;
}

export interface LeaderboardEntry {
  rank: number;
  agent_id: string;
  name: string;
  return_pct: string;
  sharpe_ratio: number;
  capital_managed: number;
  completed_cycles: number;
  tier: number;
}

export interface StartupStatus {
  startup_id: string;
  name: string;
  status: ProposalStatus;
  capital_seeking: number;
  capital_funded: number;
  funding_progress: string;
  collateral: number;
  fees_received: number;
  token_address: string;
  token_price_current: number;
  investor_count: number;
  commitment_period_days: number;
  days_remaining: number;
  created_at: string;
}

export interface AgentStatus {
  agent_id: string;
  name: string;
  status: ProposalStatus;
  capital_required: number;
  capital_funded: number;
  collateral: number;
  current_balance: number;
  pnl: number;
  pnl_pct: string;
  fees_received: number;
  tier: number;
  commitment_period_days: number;
  days_remaining: number;
  last_pnl_report: string | null;
  created_at: string;
}

export interface PnlSnapshot {
  agent_id: string;
  current_balance: number;
  open_positions: OpenPosition[];
  timestamp: string;
}

export interface OpenPosition {
  token: string;
  amount: number;
  entry_price: number;
  current_price: number;
}

export interface ClaimResult {
  success: boolean;
  proposal_id: string;
  claim_amount: number;
  tx_hash: string;
  message: string;
}
