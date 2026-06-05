import type { GameStateRows } from "./rows.js";

export function snapshotToSql(rows: GameStateRows): string {
  const statements = [
    "begin;",
    "truncate table turn_logs, command_queue, island_cells, islands, game_state restart identity cascade;",
    insertGameState(rows),
    ...rows.islands.map((row) =>
      insertInto("islands", {
        id: row.id,
        name: row.name,
        money: row.money,
        food: row.food,
        population: row.population,
        area: row.area,
        score: row.score,
        farm_size: row.farmSize,
        factory_size: row.factorySize,
        mine_size: row.mineSize,
        absent_turns: row.absentTurns,
        invalid_command_policy: row.invalidCommandPolicy
      })
    ),
    ...rows.cells.map((row) =>
      insertInto("island_cells", {
        island_id: row.islandId,
        x: row.x,
        y: row.y,
        terrain: row.terrain,
        value: row.value
      })
    ),
    ...rows.commandQueue.map((row) =>
      insertInto("command_queue", {
        island_id: row.islandId,
        position: row.position,
        kind: row.kind,
        x: row.x,
        y: row.y,
        target_island_id: row.targetIslandId,
        arg: row.arg
      })
    ),
    "commit;"
  ];

  return `${statements.join("\n")}\n`;
}

function insertGameState(rows: GameStateRows): string {
  return insertInto("game_state", {
    id: rows.gameState.id,
    turn: rows.gameState.turn,
    last_turn_at: rows.gameState.lastTurnAt,
    rules_json: `${rows.gameState.rulesJson}::jsonb`
  });
}

function insertInto(table: string, values: Record<string, string | number | null>): string {
  const columns = Object.keys(values);
  const sqlValues = Object.values(values).map(sqlValue);
  return `insert into ${table} (${columns.join(", ")}) values (${sqlValues.join(", ")});`;
}

function sqlValue(value: string | number | null): string {
  if (value === null) return "null";
  if (typeof value === "number") return String(value);
  if (value.endsWith("::jsonb")) return `'${escapeSql(value.slice(0, -"::jsonb".length))}'::jsonb`;
  return `'${escapeSql(value)}'`;
}

function escapeSql(value: string): string {
  return value.replaceAll("'", "''");
}
