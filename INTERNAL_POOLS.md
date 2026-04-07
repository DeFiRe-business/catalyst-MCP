# Internal Pools — MCP Extension

**IMPORTANT: This document extends CLAUDE.md. Read both.**

## New MCP Tools for Internal Pool Network

### `smart_route`

Find optimal routing between internal (zero-fee) and external Uniswap pools.

```typescript
server.tool(
  "smart_route",
  "Find optimal routing between Catalyst internal pools (zero-fee, micro-fee via hook) and external Uniswap pools. Returns recommended split and expected savings vs. going 100% external.",
  {
    token_in: z.string().describe("Address or symbol of input token (e.g., 'ETH', 'USDC', '0x...')"),
    token_out: z.string().describe("Address or symbol of output token"),
    amount_in: z.number().describe("Amount of input token to swap"),
    execute: z.boolean().default(false).describe("If true, execute the swap. If false, return quote only."),
    max_slippage_bps: z.number().default(50).describe("Max slippage tolerance in basis points")
  },
  async ({ token_in, token_out, amount_in, execute, max_slippage_bps }) => {
    // 1. Query internal pool price and liquidity
    // 2. Query external pool price and liquidity
    // 3. Calculate optimal split
    // 4. If execute=true, call CatalystRouter.executeRoute()
    // 5. Return route details with savings calculation
  }
);
```

### `get_internal_pools`

List available internal Catalyst pools.

```typescript
server.tool(
  "get_internal_pools",
  "List available internal Catalyst pools with liquidity, prices, volume, and micro-fee rate. These pools have zero Uniswap fees — only a micro-fee charged by the hook.",
  {
    token: z.string().optional().describe("Filter by token address or symbol"),
  },
  async ({ token }) => {
    // Query all internal pools from the InternalHook
    // Return: pair, TVL, price, 24h volume, micro-fee rate, price vs external
  }
);
```

### `get_arb_opportunities`

Detect arbitrage opportunities between internal and external pools.

```typescript
server.tool(
  "get_arb_opportunities",
  "Detect price differences between Catalyst internal pools and external Uniswap pools. Returns actionable arbitrage opportunities.",
  {
    min_profit_bps: z.number().default(10).describe("Minimum profit in bps to consider (default: 0.1%)"),
    limit: z.number().default(5).describe("Max opportunities to return")
  },
  async ({ min_profit_bps, limit }) => {
    // For each internal pool:
    //   1. Get internal price
    //   2. Get external price for same pair
    //   3. Calculate spread
    //   4. If spread > min_profit_bps, include in results
    // Return sorted by profit potential
  }
);
```

## Trading Agent Template Updates

The trading-agent example should be updated to use smart routing:

```typescript
// In agent trading loop:
// Instead of directly calling Uniswap MCP for swaps,
// first check smart_route for optimal execution:

const route = await catalystMCP.call("smart_route", {
  token_in: "ETH",
  token_out: "USDC",
  amount_in: 10,
  execute: false
});

if (route.saved_vs_external > 0) {
  // Execute via smart router (internal + external split)
  await catalystMCP.call("smart_route", {
    token_in: "ETH",
    token_out: "USDC",
    amount_in: 10,
    execute: true
  });
} else {
  // Go 100% external via Uniswap MCP
  await uniswapMCP.call("swap", { ... });
}
```

### New Strategy: `arbitrage-internal.ts`

A strategy specifically designed to profit from price differences between internal and external pools:

```typescript
class InternalArbStrategy implements BaseStrategy {
  name = "internal-arbitrage";
  description = "Arbitrage between Catalyst internal pools and external Uniswap pools";

  async scan(catalystMCP, uniswapMCP): Promise<Opportunity[]> {
    const arbs = await catalystMCP.call("get_arb_opportunities", {
      min_profit_bps: 10
    });
    return arbs.map(a => ({
      pool: a.internal_pool,
      direction: a.buy_internal ? "buy" : "sell",
      token: a.token,
      expectedProfit: a.expected_profit,
      confidence: a.spread_bps / 100,
      size: a.optimal_size
    }));
  }
}
```
