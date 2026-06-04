# DB Plan

The game engine stays in `packages/core`. DB code lives in `packages/db` and
must load/save plain `GameState` objects instead of calling turn rules directly.

The intended boundary is:

```ts
const loaded = await repository.loadGameState();
const result = advanceTurn(loaded.state, { rules: loaded.rules });
await repository.saveTurnResult(result, loaded.rules);
```

## Tables

The first PostgreSQL schema is in `packages/db/schema/postgres.sql`.

- `game_state`: global turn clock and serialized `GameRules`.
- `islands`: island-level values and player preferences.
- `island_cells`: one row per map cell.
- `command_queue`: ordered queued commands per island.
- `turn_logs`: append-only turn logs.

## Persistence Strategy

Phase 2 can start with full snapshot saves after every turn because the map is
small. Before scaling beyond hundreds of islands, change the adapter to write
only changed islands/cells and append logs in batches.

The row mapper in `packages/db/src/rows.ts` is deliberately independent of any
specific driver. A Prisma, Kysely, or raw `pg` adapter can reuse the same row
shape.
