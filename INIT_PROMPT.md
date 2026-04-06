# DeFiRe Catalyst MCP — Server & Agent Examples

## Project Overview

This is the MCP (Model Context Protocol) server for DeFiRe Catalyst, plus example agents that connect to it. The MCP server acts as the interface between AI agents and the Catalyst protocol — agents discover investment proposals, evaluate opportunities, accept jobs, and operate autonomously.

**Three types of agents connect to this MCP:**
1. **Investor agents** — Browse startups/trading agents, fund proposals, manage positions
2. **Startup agents** — Register projects, accept funding, operate with fees, buy back tokens
3. **Trading agents** — Accept trading proposals, execute strategies via Uniswap v4, generate profit

**The MCP server also integrates with Uniswap v4's MCP** for trading operations: https://docs.uniswap.org/llms/overview

---

## Directory Structure

```
catalyst-MCP/
├── CLAUDE.md                    # This file
├── server/                      # MCP Server
│   ├── src/
│   │   ├── index.ts             # Server entry point
│   │   ├── tools/               # MCP tool definitions
│   │   │   ├── marketplace.ts   # Proposal listing, search, filtering
│   │   │   ├── investor.ts      # Investor-specific actions
│   │   │   ├── startup.ts       # Startup-specific actions
│   │   │   ├── trading.ts       # Trading agent-specific actions
│   │   │   ├── leaderboard.ts   # Rankings and metrics
│   │   │   └── status.ts        # General protocol status
│   │   ├── resources/           # MCP resources (read-only data)
│   │   │   ├── protocol-stats.ts
│   │   │   └── fee-schedule.ts
│   │   ├── blockchain/          # On-chain interaction layer
│   │   │   ├── contracts.ts     # Contract ABIs and addresses
│   │   │   ├── pools.ts         # Uniswap pool interactions
│   │   │   └── events.ts       # Event listeners
│   │   └── config.ts            # Network config, addresses
│   ├── package.json
│   └── tsconfig.json
│
├── examples/                    # Example agents that connect to the MCP
│   ├── investor-agent/          # Example investor agent
│   │   ├── src/
│   │   │   ├── agent.ts         # Agent core logic
│   │   │   ├── evaluator.ts     # Proposal evaluation logic
│   │   │   └── config.ts
│   │   ├── claude-config.json   # Claude Desktop MCP config
│   │   ├── package.json
│   │   └── README.md
│   │
│   ├── startup-agent/           # Example startup agent
│   │   ├── src/
│   │   │   ├── agent.ts         # Agent core logic
│   │   │   ├── operations.ts    # How the startup uses fees
│   │   │   ├── buyback.ts       # Token buyback strategy
│   │   │   └── config.ts
│   │   ├── claude-config.json
│   │   ├── package.json
│   │   └── README.md
│   │
│   └── trading-agent/           # Example trading agent (CLONEABLE TEMPLATE)
│       ├── src/
│       │   ├── agent.ts         # Agent entry point & lifecycle
│       │   ├── mcp/
│       │   │   ├── catalyst.ts  # Connection to Catalyst MCP
│       │   │   └── uniswap.ts   # Connection to Uniswap v4 MCP
│       │   ├── strategies/
│       │   │   ├── base-strategy.ts    # Strategy interface to implement
│       │   │   ├── arbitrage.ts        # Example: cross-pool arbitrage
│       │   │   ├── momentum.ts         # Example: momentum / trend following
│       │   │   └── market-making.ts    # Example: basic market making
│       │   ├── risk/
│       │   │   ├── position-sizing.ts  # Kelly criterion / fixed fraction
│       │   │   ├── stop-loss.ts        # Stop-loss management
│       │   │   └── exposure.ts         # Max exposure limits
│       │   ├── capital/
│       │   │   ├── fee-manager.ts      # Manages received fees allocation
│       │   │   └── profit-tracker.ts   # Tracks P&L for reporting
│       │   └── config.ts
│       ├── claude-config.json
│       ├── agent-config.yaml    # Strategy and risk parameters
│       ├── package.json
│       └── README.md
│
├── docs/
│   ├── MCP-SPEC.md              # Full MCP tool specification
│   ├── AGENT-GUIDE.md           # How to build an agent
│   └── INTEGRATION.md           # How to integrate with Uniswap MCP
│
├── package.json                 # Root package
└── .gitignore
```

---

## MCP Server — Tool Definitions

### Marketplace Tools (available to all agents)

#### `list_proposals`
List active investment/funding proposals with filtering.

```typescript
{
  name: "list_proposals",
  description: "List active proposals on DeFiRe Catalyst marketplace. Returns startups seeking funding and trading agent opportunities.",
  inputSchema: {
    type: "object",
    properties: {
      track: {
        type: "string",
        enum: ["startup", "trading", "all"],
        description: "Filter by track type",
        default: "all"
      },
      status: {
        type: "string",
        enum: ["funding", "active", "completed", "failed", "all"],
        description: "Filter by status",
        default: "funding"
      },
      sort_by: {
        type: "string",
        enum: ["newest", "capital_desc", "collateral_ratio_desc", "return_desc"],
        default: "newest"
      },
      min_capital: { type: "number", description: "Minimum capital in USD" },
      max_capital: { type: "number", description: "Maximum capital in USD" },
      limit: { type: "number", default: 20 }
    }
  }
}
```

Returns:
```json
{
  "proposals": [
    {
      "id": "prop_001",
      "track": "startup",
      "name": "Neuron Analytics",
      "description": "On-chain analytics platform for DeFi protocols",
      "status": "funding",
      "capital_seeking": 120000,
      "capital_funded": 45000,
      "collateral": 8500,
      "collateral_ratio": "7.08%",
      "commitment_period_days": 180,
      "token_allocation_investors": "20%",
      "token_address": "0x...",
      "pool1_address": "0x...",
      "pool2_address": "0x...",
      "created_at": "2026-04-01T00:00:00Z"
    },
    {
      "id": "prop_002",
      "track": "trading",
      "name": "AlphaVault v2",
      "description": "Mean-reversion strategy on ETH/USDC",
      "status": "active",
      "capital_required": 50000,
      "collateral": 5000,
      "collateral_ratio": "10%",
      "commitment_period_days": 30,
      "min_return_bps": 200,
      "profit_split": { "investor": 70, "agent": 20, "protocol": 10 },
      "agent_tier": 3,
      "agent_address": "0x7a3f...e92b",
      "created_at": "2026-03-28T00:00:00Z"
    }
  ]
}
```

#### `get_proposal_details`
Get full details of a specific proposal.

```typescript
{
  name: "get_proposal_details",
  description: "Get comprehensive details about a specific proposal including pool stats, investor list, and performance data.",
  inputSchema: {
    type: "object",
    properties: {
      proposal_id: { type: "string", description: "Proposal ID" }
    },
    required: ["proposal_id"]
  }
}
```

#### `evaluate_proposal`
Ask the protocol to compute metrics for evaluating a proposal.

```typescript
{
  name: "evaluate_proposal",
  description: "Get computed metrics to evaluate a proposal's economic viability. Returns estimated fees, projected returns, risk metrics.",
  inputSchema: {
    type: "object",
    properties: {
      proposal_id: { type: "string" },
      investment_amount: { type: "number", description: "How much the agent would invest/commit" }
    },
    required: ["proposal_id"]
  }
}
```

Returns:
```json
{
  "proposal_id": "prop_001",
  "estimated_daily_fees_usd": 12.50,
  "estimated_monthly_fees_usd": 375,
  "pool_volume_24h": 250000,
  "pool_apy_current": "4.2%",
  "collateral_coverage": "7.08%",
  "risk_score": "medium",
  "similar_proposals_avg_return": "8.5%",
  "breakeven_days": 45
}
```

#### `get_leaderboard`
Agent performance rankings.

```typescript
{
  name: "get_leaderboard",
  description: "Get ranked leaderboard of trading agents by performance.",
  inputSchema: {
    type: "object",
    properties: {
      period: { type: "string", enum: ["7d", "30d", "90d", "all"], default: "30d" },
      sort_by: { type: "string", enum: ["return", "sharpe", "capital", "cycles"], default: "return" },
      limit: { type: "number", default: 10 }
    }
  }
}
```

#### `get_protocol_stats`
Global protocol metrics.

```typescript
{
  name: "get_protocol_stats",
  description: "Get global DeFiRe Catalyst protocol statistics.",
  inputSchema: { type: "object", properties: {} }
}
```

Returns: Total TVL, active proposals count, fees distributed, avg investor return, total agents, total startups.

---

### Investor Tools

#### `fund_proposal`
Fund a startup or back a trading agent.

```typescript
{
  name: "fund_proposal",
  description: "Fund a startup proposal (add liquidity to Pool 1) or back a trading agent (deposit capital to escrow). Returns transaction hash.",
  inputSchema: {
    type: "object",
    properties: {
      proposal_id: { type: "string" },
      amount: { type: "number", description: "Amount in USDx to invest" },
      token: { type: "string", enum: ["USDC", "USDT", "DAI"], default: "USDC" }
    },
    required: ["proposal_id", "amount"]
  }
}
```

#### `get_my_positions`
Get all positions for the connected wallet.

```typescript
{
  name: "get_my_positions",
  description: "Get all investment positions for the connected wallet across both tracks.",
  inputSchema: {
    type: "object",
    properties: {
      track: { type: "string", enum: ["startup", "trading", "all"], default: "all" }
    }
  }
}
```

#### `withdraw_liquidity`
Withdraw from a position. Will trigger early exit penalties if before commitment deadline.

```typescript
{
  name: "withdraw_liquidity",
  description: "Withdraw liquidity from a position. WARNING: If before commitment deadline, investor loses token allocation and claim rights. Tokens are redistributed to remaining investors.",
  inputSchema: {
    type: "object",
    properties: {
      proposal_id: { type: "string" },
      amount: { type: "number", description: "Amount to withdraw. Use 0 for full withdrawal." },
      confirm_early_exit: { type: "boolean", description: "Must be true if withdrawing before commitment deadline" }
    },
    required: ["proposal_id"]
  }
}
```

#### `file_claim`
File a claim against a failed agent/startup's collateral.

```typescript
{
  name: "file_claim",
  description: "File a claim against collateral of a failed agent/startup via ERC-8210 AssuranceAccount.",
  inputSchema: {
    type: "object",
    properties: {
      proposal_id: { type: "string" },
      claim_amount: { type: "number", description: "Amount to claim. Max = investor's pro-rata share of collateral." }
    },
    required: ["proposal_id"]
  }
}
```

---

### Startup Agent Tools

#### `register_startup`
Register a new startup on the platform.

```typescript
{
  name: "register_startup",
  description: "Register a new startup on DeFiRe Catalyst. Creates TOKEN automatically, deploys Pool 1 and Pool 2, and locks collateral.",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string" },
      description: { type: "string" },
      capital_seeking: { type: "number", description: "Total funding sought in USD" },
      collateral_amount: { type: "number", description: "Collateral to deposit in USDx" },
      commitment_period_days: { type: "number", description: "How long investors commit capital" },
      token_name: { type: "string", description: "Name for the startup token" },
      token_symbol: { type: "string", description: "Symbol for the startup token (3-5 chars)" },
      token_allocation_investors: { type: "number", description: "Percentage of token supply for investors (e.g., 20)" },
      min_token_price_target: { type: "number", description: "Minimum token price at evaluation (in USDx)" }
    },
    required: ["name", "description", "capital_seeking", "collateral_amount", "commitment_period_days", "token_name", "token_symbol"]
  }
}
```

#### `get_my_startup_status`
Get current status of the agent's registered startup.

```typescript
{
  name: "get_my_startup_status",
  description: "Get current status: funding progress, fees received, token price, investor count, time remaining.",
  inputSchema: {
    type: "object",
    properties: {
      startup_id: { type: "string" }
    },
    required: ["startup_id"]
  }
}
```

#### `buyback_token`
Buy back the startup's own token using operational funds.

```typescript
{
  name: "buyback_token",
  description: "Buy back the startup's TOKEN on Pool 2 using USDx. Creates buy pressure and increases token value for investors.",
  inputSchema: {
    type: "object",
    properties: {
      startup_id: { type: "string" },
      amount_usdx: { type: "number", description: "Amount of USDx to spend on buyback" },
      max_slippage_bps: { type: "number", default: 100, description: "Max slippage in basis points" }
    },
    required: ["startup_id", "amount_usdx"]
  }
}
```

---

### Trading Agent Tools

#### `register_trading_agent`
Register as a trading agent on the platform.

```typescript
{
  name: "register_trading_agent",
  description: "Register as a trading agent on DeFiRe Catalyst. Deposit collateral and define strategy parameters.",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string" },
      strategy_description: { type: "string" },
      capital_required: { type: "number", description: "Capital needed from investors" },
      collateral_amount: { type: "number", description: "Collateral to deposit" },
      commitment_period_days: { type: "number" },
      min_return_bps: { type: "number", description: "Minimum guaranteed return in basis points (200 = 2%)" },
      profit_split_investor_bps: { type: "number", description: "Investor's profit share in bps (7000 = 70%)" }
    },
    required: ["name", "strategy_description", "capital_required", "collateral_amount", "commitment_period_days", "min_return_bps", "profit_split_investor_bps"]
  }
}
```

#### `get_my_agent_status`
Get current status of the trading agent.

```typescript
{
  name: "get_my_agent_status",
  description: "Get trading agent status: P&L, capital available, fees received, time remaining, tier.",
  inputSchema: {
    type: "object",
    properties: {
      agent_id: { type: "string" }
    },
    required: ["agent_id"]
  }
}
```

#### `report_pnl`
Report current P&L snapshot (called periodically by the agent).

```typescript
{
  name: "report_pnl",
  description: "Submit a P&L snapshot. Updates the on-chain record and investor-visible metrics.",
  inputSchema: {
    type: "object",
    properties: {
      agent_id: { type: "string" },
      current_balance: { type: "number" },
      open_positions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            token: { type: "string" },
            amount: { type: "number" },
            entry_price: { type: "number" },
            current_price: { type: "number" }
          }
        }
      }
    },
    required: ["agent_id", "current_balance"]
  }
}
```

---

## Example Agent: Trading Agent Template

This is the primary cloneable template. Developers clone this, implement their strategy, and connect to the protocol.

### `agent-config.yaml`

```yaml
# DeFiRe Catalyst Trading Agent Configuration

agent:
  name: "MyTradingBot"
  strategy: "momentum"         # Which strategy class to use
  
network:
  chain_id: 84532              # Base Sepolia
  rpc_url: "${RPC_URL}"        # From .env
  
mcp:
  catalyst_server: "http://localhost:3100"     # Catalyst MCP endpoint
  uniswap_server: "https://mcp.uniswap.org"   # Uniswap v4 MCP (check docs for latest URL)

wallet:
  private_key: "${AGENT_PRIVATE_KEY}"          # From .env

capital:
  # How to allocate received fees / available capital
  trading_allocation: 0.60      # 60% for active trading
  reserve_allocation: 0.25      # 25% kept as reserve / safety buffer
  buyback_allocation: 0.15      # 15% for operational costs (N/A for Track 2, but kept for flexibility)

risk:
  max_position_size: 0.20       # Max 20% of capital in a single position
  max_total_exposure: 0.80      # Max 80% of capital deployed at once
  stop_loss_pct: 0.05           # 5% stop loss per position
  max_drawdown_pct: 0.15        # 15% max portfolio drawdown → pause trading
  
trading:
  pools:                        # Uniswap v4 pools to trade on
    - "ETH/USDC"
    - "WBTC/USDC"
  min_profit_threshold: 0.002   # Minimum 0.2% profit to execute trade
  check_interval_seconds: 30    # How often to check for opportunities
  
reporting:
  pnl_report_interval: 3600    # Report P&L every hour (seconds)
```

### `src/agent.ts` — Entry Point Logic

```typescript
/**
 * DeFiRe Catalyst Trading Agent
 * 
 * Lifecycle:
 * 1. Connect to Catalyst MCP
 * 2. Browse and evaluate proposals
 * 3. Accept a suitable proposal (deposit collateral)
 * 4. Wait for funding phase to complete
 * 5. Execute trading strategy with allocated capital
 * 6. Periodically report P&L
 * 7. At commitment deadline, close positions and settle
 * 
 * The agent uses TWO MCP servers:
 * - Catalyst MCP: For protocol interaction (proposals, status, P&L reporting)
 * - Uniswap v4 MCP: For actual trading operations (swaps, pool queries)
 */

// Pseudocode structure:
class TradingAgent {
  catalystMCP: MCPClient;     // Connection to Catalyst MCP
  uniswapMCP: MCPClient;      // Connection to Uniswap v4 MCP
  strategy: BaseStrategy;      // Trading strategy instance
  riskManager: RiskManager;    // Risk management
  config: AgentConfig;         // From agent-config.yaml

  async start() {
    // 1. Connect to both MCP servers
    await this.connectMCPs();
    
    // 2. Browse proposals
    const proposals = await this.catalystMCP.call("list_proposals", {
      track: "trading",
      status: "funding"
    });
    
    // 3. Evaluate each proposal
    for (const proposal of proposals) {
      const evaluation = await this.catalystMCP.call("evaluate_proposal", {
        proposal_id: proposal.id,
        investment_amount: this.config.capital.available
      });
      
      if (this.meetsMinCriteria(evaluation)) {
        // 4. Accept proposal
        await this.catalystMCP.call("register_trading_agent", { ... });
        break;
      }
    }
    
    // 5. Wait for funding phase
    await this.waitForActivePhase();
    
    // 6. Trading loop
    while (this.isActive()) {
      // Check for opportunities via Uniswap MCP
      const opportunities = await this.strategy.scan(this.uniswapMCP);
      
      for (const opp of opportunities) {
        if (this.riskManager.approve(opp)) {
          await this.strategy.execute(opp, this.uniswapMCP);
        }
      }
      
      // Report P&L periodically
      if (this.shouldReport()) {
        await this.catalystMCP.call("report_pnl", {
          agent_id: this.agentId,
          current_balance: await this.getBalance(),
          open_positions: await this.getPositions()
        });
      }
      
      await this.sleep(this.config.trading.check_interval_seconds * 1000);
    }
    
    // 7. Close positions and settle
    await this.closeAllPositions();
  }
}
```

### `src/strategies/base-strategy.ts` — Strategy Interface

```typescript
/**
 * Base strategy interface. Implement this to create your own trading strategy.
 * 
 * The strategy receives an MCP client connected to Uniswap v4.
 * Use it to query pool states, check prices, and execute swaps.
 */
interface BaseStrategy {
  name: string;
  description: string;
  
  // Scan the market for trading opportunities
  scan(uniswapMCP: MCPClient): Promise<Opportunity[]>;
  
  // Execute a trade
  execute(opportunity: Opportunity, uniswapMCP: MCPClient): Promise<TradeResult>;
  
  // Should the strategy close a position?
  shouldClose(position: Position, uniswapMCP: MCPClient): Promise<boolean>;
}

interface Opportunity {
  pool: string;
  direction: "buy" | "sell";
  token: string;
  expectedProfit: number;
  confidence: number;
  size: number;
}

interface TradeResult {
  success: boolean;
  txHash?: string;
  amountIn: number;
  amountOut: number;
  profit: number;
}
```

---

## Integration with Uniswap v4 MCP

The trading agent connects to Uniswap v4's official MCP server for all trading operations. Reference: https://docs.uniswap.org/llms/overview

Key tools the agent uses from Uniswap MCP:
- Query pool states (prices, liquidity, tick data)
- Execute swaps (exactInput, exactOutput)
- Get quotes (estimate swap outcomes)
- Read pool fees and volume
- Monitor price movements

The Catalyst MCP does NOT duplicate Uniswap functionality — it only handles protocol-specific operations (proposals, collateral, P&L tracking). All trading goes through Uniswap's MCP.

```
Agent
├── Catalyst MCP → Protocol operations
│   ├── list_proposals
│   ├── register_trading_agent
│   ├── get_my_agent_status
│   └── report_pnl
│
└── Uniswap v4 MCP → Trading operations
    ├── getPoolState
    ├── quote
    ├── swap
    └── getPositions
```

---

## MCP Server Setup

### Tech Stack
- TypeScript
- `@modelcontextprotocol/sdk` for MCP server implementation
- `ethers.js` v6 for blockchain interaction
- Express for HTTP transport (SSE)

### Transport
The MCP server supports both:
- **stdio** — for local Claude Desktop / Claude Code connections
- **SSE (Server-Sent Events)** — for remote agent connections

### Configuration for Claude Desktop

```json
{
  "mcpServers": {
    "defire-catalyst": {
      "command": "node",
      "args": ["./server/dist/index.js"],
      "env": {
        "RPC_URL": "https://sepolia.base.org",
        "REGISTRY_ADDRESS": "0x...",
        "HOOK_ADDRESS": "0x..."
      }
    }
  }
}
```

---

## Development Priorities

### Phase 1: MCP Server Core
1. Set up MCP server with `@modelcontextprotocol/sdk`
2. Implement marketplace tools: `list_proposals`, `get_proposal_details`, `evaluate_proposal`, `get_protocol_stats`
3. Implement investor tools: `fund_proposal`, `get_my_positions`, `withdraw_liquidity`
4. Connect to Catalyst smart contracts on Base Sepolia
5. Test with Claude Desktop as client

### Phase 2: Agent Registration Tools
1. Implement `register_startup`, `register_trading_agent`
2. Implement status tools: `get_my_startup_status`, `get_my_agent_status`
3. Implement `buyback_token`, `report_pnl`
4. Implement `file_claim`

### Phase 3: Example Agents
1. Build trading agent template with full lifecycle
2. Implement 3 example strategies (arbitrage, momentum, market-making)
3. Build investor agent example (auto-evaluate and fund proposals)
4. Build startup agent example
5. Write comprehensive README for each

### Phase 4: Integration & Docs
1. Test full flow: startup registers → investor funds → agent trades → evaluation → settlement
2. Integration tests with Uniswap v4 MCP
3. Write AGENT-GUIDE.md
4. Write INTEGRATION.md
5. Publish MCP server for remote connections (SSE endpoint)

---

## Related Standards & References

- **ERC-8183 (Agentic Commerce):** https://ethereum-magicians.org/t/erc-8183-agentic-commerce/27902
- **ERC-8210 (Agent Assurance):** https://ethereum-magicians.org/t/erc-8210-agent-assurance/28097
- **Uniswap v4 MCP:** https://docs.uniswap.org/llms/overview
- **MCP Specification:** https://spec.modelcontextprotocol.io/
- **MCP TypeScript SDK:** https://github.com/modelcontextprotocol/typescript-sdk
- **Demsys ERC-8183 on Base Sepolia:** github.com/Demsys/agent-settlement-protocol
