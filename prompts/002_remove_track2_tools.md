# 002 — Limpiar Track 2 del MCP de Catalyst

Catalyst se queda solo con Track 1 (startup launchpad). Las herramientas relacionadas con trading agents (Track 2) se mueven al nuevo MCP de Lockstep en `../../lockstep/lockstep-MCP/`.

## Limpieza

### `server/src/tools/`

**Borra `trading.ts` por completo.** Era el tool file para trading agents (`register_trading_agent`, `get_my_agent_status`, `report_pnl`).

**`marketplace.ts`** — En `list_proposals`, elimina el filtro `track` y cualquier rama que devuelva trading agents. Ahora solo devuelve startups. En `get_proposal_details`, simplifica para devolver siempre `StartupProposal`. En `evaluate_proposal`, simplifica el cálculo para que solo aplique a startups.

**`investor.ts`** — En `fund_proposal`, ya no necesita distinguir entre fondear una startup vs back un trading agent. Simplifica para que solo fondee startups (deposit en Pool 1). Lo mismo con `withdraw_position` y `get_my_positions`.

**`leaderboard.ts`** — Elimina el sort por trading agent metrics. El leaderboard de Catalyst ahora rankea startups por: token price appreciation, Pool 2 volume, investor count, time since launch.

**`status.ts`** — En `get_protocol_stats`, elimina campos relacionados con trading agents (active_agents, agent_capital_managed, etc.). Deja: `total_tvl_pool1`, `total_pool2_volume`, `startups_launched`, `tokens_protocol_holds`, `total_fees_distributed`, `avg_token_appreciation`.

### `server/src/index.ts`

Elimina el import y la llamada a `registerTradingTools(server)`. Verifica que solo se registran los tool files que quedan: marketplace, investor, leaderboard, status.

### `server/src/types.ts`

Borra los tipos `TradingProposal`, `TradingAgentInfo`, `OpenPosition`, `EvaluationResult` (la versión para trading), y cualquier discriminated union que mezclara startups + trading. Mantén solo los tipos relacionados con startups.

### `server/src/data-store.ts`

Elimina los proposals de tipo trading del mock data. Deja solo startups. Limpia las funciones helper que filtraban por track.

### `server/src/blockchain/contracts.ts`

Elimina el ABI de `getTradingAgent`, `registerTradingAgent`, eventos `TradingAgentRegistered`. Elimina las funciones `getTradingAgentFromChain`, `getInvestorPositionFromChain` (esta era para Track 2 escrow). Mantén solo las funciones relacionadas con startups.

### `examples/trading-agent/`

**Borra la carpeta entera.** El trading-agent template ahora vive en `../../lockstep/lockstep-MCP/examples/trading-agent/`. Catalyst no tiene trading agents.

### `examples/`

Si existe `examples/investor-agent/`, revísalo: si está orientado a backear trading agents, bórralo o adaptalo para que sea un investor agent que invierte en startups. Si existe `examples/startup-agent/`, mantenlo y verifica que está actualizado para la nueva interfaz simplificada del registry.

### `CLAUDE.md`

Reescribe el `CLAUDE.md` del MCP de Catalyst para reflejar que el MCP es exclusivamente para startups y agentes que las gestionan. Elimina toda mención de trading agents, internal pools, smart routing. Añade una sección "Sister project" enlazando a `../../lockstep/lockstep-MCP/CLAUDE.md`.

## Verificación

1. `cd server && npm run build` debe compilar sin errores tras la limpieza.
2. Ejecuta el server con `node dist/index.js` y verifica que arranca sin tirar errores.
3. Lista los tools que quedan registrados.

Cuando termines:
- Lista archivos eliminados
- Lista tools que ya no existen
- Confirmación de que el server compila y arranca
