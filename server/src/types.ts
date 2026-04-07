export type ProposalStatus = "funding" | "active" | "completed" | "failed";

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

export type Proposal = StartupProposal;

export interface InvestorPosition {
  proposal_id: string;
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
  total_tvl_pool1: number;
  total_pool2_volume: number;
  startups_launched: number;
  tokens_protocol_holds: number;
  total_fees_distributed: number;
  avg_token_appreciation: string;
}

export interface LeaderboardEntry {
  rank: number;
  startup_id: string;
  name: string;
  token_appreciation: string;
  pool2_volume: number;
  investor_count: number;
  days_since_launch: number;
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

export interface ClaimResult {
  success: boolean;
  proposal_id: string;
  claim_amount: number;
  tx_hash: string;
  message: string;
}
