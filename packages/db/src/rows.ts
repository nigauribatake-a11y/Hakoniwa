import type {
  Cell,
  CommandKind,
  CommandPlan,
  GameRules,
  GameState,
  InvalidCommandPolicy,
  Island,
  TerrainKind,
  TurnLog
} from "../../core/src/index.js";

export interface GameStateRow {
  id: "default";
  turn: number;
  lastTurnAt: number;
  rulesJson: string;
}

export interface IslandRow {
  id: string;
  name: string;
  money: number;
  food: number;
  population: number;
  area: number;
  score: number;
  farmSize: number;
  factorySize: number;
  mineSize: number;
  absentTurns: number;
  invalidCommandPolicy: InvalidCommandPolicy;
}

export interface CellRow {
  islandId: string;
  x: number;
  y: number;
  terrain: TerrainKind;
  value: number;
}

export interface CommandQueueRow {
  islandId: string;
  position: number;
  kind: CommandKind;
  x: number;
  y: number;
  targetIslandId: string | null;
  arg: number | null;
}

export interface TurnLogRow {
  id: number;
  turn: number;
  islandId: string;
  message: string;
}

export interface GameStateRows {
  gameState: GameStateRow;
  islands: IslandRow[];
  cells: CellRow[];
  commandQueue: CommandQueueRow[];
}

export function gameStateToRows(state: GameState, rules: GameRules): GameStateRows {
  return {
    gameState: {
      id: "default",
      turn: state.turn,
      lastTurnAt: state.lastTurnAt,
      rulesJson: JSON.stringify(rules)
    },
    islands: state.islands.map(islandToRow),
    cells: state.islands.flatMap((island) => island.cells.flat().map((cell) => cellToRow(island, cell))),
    commandQueue: state.islands.flatMap((island) =>
      island.commandQueue.map((command, position) => commandToRow(island, command, position))
    )
  };
}

export function rowsToGameState(rows: GameStateRows): {
  state: GameState;
  rules: GameRules;
} {
  const islands = rows.islands.map((islandRow) => {
    const islandCells = rows.cells
      .filter((cell) => cell.islandId === islandRow.id)
      .sort((a, b) => a.y - b.y || a.x - b.x);
    const width = Math.max(...islandCells.map((cell) => cell.x), 0) + 1;
    const height = Math.max(...islandCells.map((cell) => cell.y), 0) + 1;
    const cells: Cell[][] = Array.from({ length: height }, (_, y) =>
      Array.from({ length: width }, (_, x) => {
        const row = islandCells.find((cell) => cell.x === x && cell.y === y);
        if (!row) {
          return { x, y, terrain: "sea", value: 0 };
        }
        return {
          x: row.x,
          y: row.y,
          terrain: row.terrain,
          value: row.value
        };
      })
    );
    const commandQueue = rows.commandQueue
      .filter((command) => command.islandId === islandRow.id)
      .sort((a, b) => a.position - b.position)
      .map(rowToCommand);

    return rowToIsland(islandRow, cells, commandQueue);
  });

  return {
    state: {
      turn: rows.gameState.turn,
      lastTurnAt: rows.gameState.lastTurnAt,
      islands
    },
    rules: JSON.parse(rows.gameState.rulesJson) as GameRules
  };
}

export function logsToRows(turn: number, logs: TurnLog[], startingId = 1): TurnLogRow[] {
  return logs.map((log, index) => ({
    id: startingId + index,
    turn,
    islandId: log.islandId,
    message: log.message
  }));
}

function islandToRow(island: Island): IslandRow {
  return {
    id: island.id,
    name: island.name,
    money: island.money,
    food: island.food,
    population: island.population,
    area: island.area,
    score: island.score,
    farmSize: island.farmSize,
    factorySize: island.factorySize,
    mineSize: island.mineSize,
    absentTurns: island.absentTurns,
    invalidCommandPolicy: island.invalidCommandPolicy
  };
}

function cellToRow(island: Island, cell: Cell): CellRow {
  return {
    islandId: island.id,
    x: cell.x,
    y: cell.y,
    terrain: cell.terrain,
    value: cell.value
  };
}

function commandToRow(
  island: Island,
  command: CommandPlan,
  position: number
): CommandQueueRow {
  return {
    islandId: island.id,
    position,
    kind: command.kind,
    x: command.x,
    y: command.y,
    targetIslandId: command.targetIslandId ?? null,
    arg: command.arg ?? null
  };
}

function rowToIsland(
  row: IslandRow,
  cells: Cell[][],
  commandQueue: CommandPlan[]
): Island {
  return {
    id: row.id,
    name: row.name,
    money: row.money,
    food: row.food,
    population: row.population,
    area: row.area,
    score: row.score,
    farmSize: row.farmSize,
    factorySize: row.factorySize,
    mineSize: row.mineSize,
    absentTurns: row.absentTurns,
    invalidCommandPolicy: row.invalidCommandPolicy,
    cells,
    commandQueue
  };
}

function rowToCommand(row: CommandQueueRow): CommandPlan {
  return {
    kind: row.kind,
    x: row.x,
    y: row.y,
    ...(row.targetIslandId === null ? {} : { targetIslandId: row.targetIslandId }),
    ...(row.arg === null ? {} : { arg: row.arg })
  };
}
