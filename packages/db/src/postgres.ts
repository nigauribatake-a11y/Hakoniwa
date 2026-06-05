import pg, { type Pool as PgPool, type PoolClient as PgPoolClient } from "pg";
import type {
  CommandKind,
  CommandPlan,
  GameRules,
  GameState,
  InvalidCommandPolicy,
  TerrainKind,
  TurnResult
} from "../../core/src/index.js";
import {
  gameStateToRows,
  rowsToGameState,
  type CellRow,
  type CommandQueueRow,
  type GameStateRow,
  type GameStateRows,
  type IslandRow
} from "./rows.js";
import type { GameRepository, LoadedGameState } from "./repository.js";

const { Pool } = pg;

export class PostgresGameRepository implements GameRepository {
  constructor(private readonly pool: PgPool) {}

  static fromConnectionString(connectionString: string): PostgresGameRepository {
    return new PostgresGameRepository(new Pool({ connectionString }));
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async loadGameState(): Promise<LoadedGameState> {
    const [gameState, islands, cells, commandQueue] = await Promise.all([
      this.loadGameStateRow(),
      this.loadIslandRows(),
      this.loadCellRows(),
      this.loadCommandQueueRows()
    ]);

    if (!gameState) {
      throw new Error("game_state row is missing. Seed the database first.");
    }

    return rowsToGameState({
      gameState,
      islands,
      cells,
      commandQueue
    });
  }

  async saveTurnResult(result: TurnResult, rules: LoadedGameState["rules"]): Promise<void> {
    const rows = gameStateToRows(result.state, rules);
    const client = await this.pool.connect();

    try {
      await client.query("begin");
      await replaceSnapshotRows(client, rows);
      for (const log of result.logs) {
        await client.query(
          "insert into turn_logs (turn, island_id, message) values ($1, $2, $3)",
          [result.state.turn, log.islandId, log.message]
        );
      }

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async saveGameState(
    state: GameState,
    rules: GameRules,
    options: { clearLogs?: boolean } = {}
  ): Promise<void> {
    const rows = gameStateToRows(state, rules);
    const client = await this.pool.connect();

    try {
      await client.query("begin");
      if (options.clearLogs) {
        await client.query("delete from turn_logs");
      }
      await replaceSnapshotRows(client, rows);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async setCommand(
    islandId: string,
    position: number,
    command: CommandPlan
  ): Promise<void> {
    const result = await this.pool.query(
      [
        "update command_queue",
        "set kind = $3, x = $4, y = $5, target_island_id = $6, arg = $7",
        "where island_id = $1 and position = $2"
      ].join(" "),
      [
        islandId,
        position,
        command.kind,
        command.x,
        command.y,
        command.targetIslandId ?? null,
        command.arg ?? null
      ]
    );

    if (result.rowCount !== 1) {
      throw new Error(`command slot not found: island=${islandId}, position=${position}`);
    }
  }

  private async loadGameStateRow(): Promise<GameStateRow | undefined> {
    const result = await this.pool.query(
      "select id, turn, last_turn_at, rules_json from game_state where id = 'default'"
    );
    const row = result.rows[0];
    if (!row) return undefined;

    return {
      id: "default",
      turn: Number(row.turn),
      lastTurnAt: Number(row.last_turn_at),
      rulesJson:
        typeof row.rules_json === "string" ? row.rules_json : JSON.stringify(row.rules_json)
    };
  }

  private async loadIslandRows(): Promise<IslandRow[]> {
    const result = await this.pool.query(
      [
        "select id, name, money, food, population, area, score, farm_size,",
        "factory_size, mine_size, absent_turns, invalid_command_policy",
        "from islands order by id"
      ].join(" ")
    );

    return result.rows.map((row: Record<string, unknown>) => ({
      id: String(row.id),
      name: String(row.name),
      money: Number(row.money),
      food: Number(row.food),
      population: Number(row.population),
      area: Number(row.area),
      score: Number(row.score),
      farmSize: Number(row.farm_size),
      factorySize: Number(row.factory_size),
      mineSize: Number(row.mine_size),
      absentTurns: Number(row.absent_turns),
      invalidCommandPolicy: row.invalid_command_policy as InvalidCommandPolicy
    }));
  }

  private async loadCellRows(): Promise<CellRow[]> {
    const result = await this.pool.query(
      "select island_id, x, y, terrain, value from island_cells order by island_id, y, x"
    );

    return result.rows.map((row: Record<string, unknown>) => ({
      islandId: String(row.island_id),
      x: Number(row.x),
      y: Number(row.y),
      terrain: row.terrain as TerrainKind,
      value: Number(row.value)
    }));
  }

  private async loadCommandQueueRows(): Promise<CommandQueueRow[]> {
    const result = await this.pool.query(
      [
        "select island_id, position, kind, x, y, target_island_id, arg",
        "from command_queue order by island_id, position"
      ].join(" ")
    );

    return result.rows.map((row: Record<string, unknown>) => ({
      islandId: String(row.island_id),
      position: Number(row.position),
      kind: row.kind as CommandKind,
      x: Number(row.x),
      y: Number(row.y),
      targetIslandId: row.target_island_id === null ? null : String(row.target_island_id),
      arg: row.arg === null ? null : Number(row.arg)
    }));
  }
}

async function replaceSnapshotRows(
  client: PgPoolClient,
  rows: GameStateRows
): Promise<void> {
  await client.query("delete from command_queue");
  await client.query("delete from island_cells");
  await client.query("delete from islands");
  await client.query("delete from game_state");

  await insertGameState(client, rows.gameState);
  for (const island of rows.islands) await insertIsland(client, island);
  for (const cell of rows.cells) await insertCell(client, cell);
  for (const command of rows.commandQueue) await insertCommand(client, command);
}

async function insertGameState(client: PgPoolClient, row: GameStateRow): Promise<void> {
  await client.query(
    "insert into game_state (id, turn, last_turn_at, rules_json) values ($1, $2, $3, $4::jsonb)",
    [row.id, row.turn, row.lastTurnAt, row.rulesJson]
  );
}

async function insertIsland(client: PgPoolClient, row: IslandRow): Promise<void> {
  await client.query(
    [
      "insert into islands (id, name, money, food, population, area, score, farm_size,",
      "factory_size, mine_size, absent_turns, invalid_command_policy)",
      "values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)"
    ].join(" "),
    [
      row.id,
      row.name,
      row.money,
      row.food,
      row.population,
      row.area,
      row.score,
      row.farmSize,
      row.factorySize,
      row.mineSize,
      row.absentTurns,
      row.invalidCommandPolicy
    ]
  );
}

async function insertCell(client: PgPoolClient, row: CellRow): Promise<void> {
  await client.query(
    "insert into island_cells (island_id, x, y, terrain, value) values ($1, $2, $3, $4, $5)",
    [row.islandId, row.x, row.y, row.terrain, row.value]
  );
}

async function insertCommand(client: PgPoolClient, row: CommandQueueRow): Promise<void> {
  await client.query(
    [
      "insert into command_queue",
      "(island_id, position, kind, x, y, target_island_id, arg)",
      "values ($1, $2, $3, $4, $5, $6, $7)"
    ].join(" "),
    [row.islandId, row.position, row.kind, row.x, row.y, row.targetIslandId, row.arg]
  );
}
