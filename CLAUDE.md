# DeFiRe Catalyst MCP

MCP server for the DeFiRe Catalyst startup launchpad. Catalyst enables startups to raise capital through Uniswap v4 pools, with investor protections via ERC-8183 (Agentic Commerce Protocol) and ERC-8210 (Assurance Accounts).

## What this MCP does

Exposes tools for three personas:

- **Investors** — browse startups, evaluate proposals, fund via Pool 1, monitor positions, withdraw liquidity, file claims against collateral
- **Startups** — register on the platform, track funding progress, buy back tokens on Pool 2
- **Observers** — view protocol stats, leaderboard, fee schedule

## Architecture

```
server/src/
  index.ts              — MCP entry point (stdio transport)
  types.ts              — Shared TypeScript types
  data-store.ts         — In-memory seed data (fallback when contracts not deployed)
  config.ts             — Network config + ethers provider singleton
  blockchain/
    contracts.ts        — On-chain reads (CatalystRegistry + CatalystHook)
    events.ts           — Event listeners for registry/hook
    pools.ts            — ERC-20 token helpers
  tools/
    marketplace.ts      — list_proposals, get_proposal_details, evaluate_proposal
    investor.ts         — fund_proposal, get_my_positions, withdraw_liquidity, file_claim
    startup.ts          — register_startup, get_my_startup_status, buyback_token
    leaderboard.ts      — get_leaderboard (startups ranked by token appreciation, pool2 volume, etc.)
    status.ts           — get_protocol_stats
  resources/
    protocol-stats.ts   — catalyst://protocol/stats resource
    fee-schedule.ts     — catalyst://protocol/fee-schedule resource
```

## Key contracts

- **CatalystRegistry** (ERC-8183) — startup registration, funding, collateral, claims
- **CatalystHook** (Uniswap v4 hook) — investor positions, token allocations, fee distribution, buybacks

## On-chain fallback pattern

Tools try on-chain reads first via `resolveProposalFromChain()`, falling back to the in-memory data-store when contracts are not configured or calls revert.

## Environment variables

See `server/.env.example`. Key vars: `RPC_URL`, `CHAIN_ID`, `REGISTRY_ADDRESS`, `HOOK_ADDRESS`, `WALLET_ADDRESS`.

## Build & run

```bash
cd server && npm run build && node dist/index.js
```

## Sister project

Trading agents (Track 2) live in [Lockstep MCP](../../lockstep/lockstep-MCP/CLAUDE.md).
