import {
  type CommandPlan,
  type CommandResult,
  type GameState,
  type GameRules,
  type Island,
  type RandomSource,
  type TurnLog,
  type TurnResult
} from "./model.js";
import {
  applyIncome,
  clearCellWork,
  cloneCells,
  commandFailureReason,
  defaultGameRules,
  estimateIsland,
  getCell,
  markCoasts,
  shiftCommandQueue,
  updateCells
} from "./rules.js";

export interface AdvanceTurnOptions {
  random?: RandomSource;
  rules?: GameRules;
}

export class DeterministicRandom implements RandomSource {
  private state: number;

  constructor(seed = 1) {
    this.state = seed >>> 0;
  }

  nextInt(maxExclusive: number): number {
    if (maxExclusive <= 0) return 0;
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state % maxExclusive;
  }
}

export function advanceTurn(
  state: GameState,
  options: AdvanceTurnOptions | RandomSource = {}
): TurnResult {
  const rules = "nextInt" in options ? defaultGameRules : options.rules ?? defaultGameRules;
  const random =
    "nextInt" in options ? options : options.random ?? new DeterministicRandom(state.turn + 1);
  const logs: TurnLog[] = [];
  const isMajorTurn = (state.turn + 1) % rules.majorTurnEverySmallTurns === 0;
  const islands = state.islands.map((island) => {
    let current = estimateIsland(island);
    const progress = progressCellWork(current);
    current = progress.island;
    logs.push(...progress.logs);

    while (true) {
      const result = executeNextCommand(current, rules);
      current = result.island;
      logs.push(...result.commandResult.logs);

      if (result.commandResult.consumeTurn) break;
    }

    if (isMajorTurn) {
      current = applyIncome(estimateIsland(current), rules);
      const cellUpdate = updateCells(current, random, rules, state.turn);
      current = cellUpdate.island;
      logs.push(...cellUpdate.logs);
    }

    return estimateIsland(current);
  });

  return {
    state: {
      ...state,
      turn: state.turn + 1,
      lastTurnAt: state.lastTurnAt + rules.smallTurnSeconds,
      islands
    },
    logs
  };
}

export function executeNextCommand(
  island: Island,
  rules: GameRules = defaultGameRules
): {
  island: Island;
  commandResult: CommandResult;
} {
  const { command, queue } = shiftCommandQueue(island.commandQueue);
  const baseIsland = { ...island, commandQueue: queue };
  const result = executeCommand(baseIsland, command, rules);

  return {
    island: result.island,
    commandResult: result.commandResult
  };
}

export function executeCommand(
  island: Island,
  command: CommandPlan,
  rules: GameRules = defaultGameRules
): {
  island: Island;
  commandResult: CommandResult;
} {
  if (command.kind === "doNothing") {
    return {
      island: {
        ...island,
        absentTurns: island.absentTurns + 1,
        money: island.money + rules.supportMoneyBase
      },
      commandResult: {
        success: true,
        consumeTurn: true,
        logs: [log(island, `${island.name} did nothing and received support funds.`)]
      }
    };
  }

  const cost = rules.commandCosts[command.kind];
  const duration = rules.commandDurations[command.kind];
  if (island.money < cost) {
    return {
      island,
      commandResult: {
        success: false,
        consumeTurn: false,
        logs: [log(island, `${island.name} could not afford ${command.kind}.`)]
      }
    };
  }

  const cells = cloneCells(island.cells);
  const cell = getCell(cells, command.x, command.y);

  if (!cell) {
    return {
      island,
      commandResult: {
        success: false,
        consumeTurn: false,
        logs: [log(island, `${island.name} selected an invalid point.`)]
      }
    };
  }

  const changed = { ...island, absentTurns: 0, cells };
  const reason = commandFailureReason(cell, command);
  if (reason) {
    return failure(island, command, reason);
  }

  if (duration > 1) {
    cell.workKind = command.kind;
    cell.workRemaining = duration - 1;
    cell.workTotal = duration;
    if (command.arg !== undefined) cell.workArg = command.arg;
    return success(changed, cost, command, true, "started");
  }

  switch (command.kind) {
    case "prepare": {
      cell.terrain = "plains";
      cell.value = 0;
      return success(changed, cost, command, true);
    }

    case "reclaim": {
      cell.terrain = "waste";
      cell.value = 0;
      markCoasts(cells);
      return success(changed, cost, command, true);
    }

    case "destroy": {
      if (cell.terrain === "mountain") {
        cell.value = 1;
      } else {
        cell.terrain = "waste";
        cell.value = 0;
      }

      return success(changed, cost, command, true);
    }

    case "sellTrees": {
      const income = cell.value * 5;
      cell.value = 0;
      cell.terrain = "plains";
      return {
        island: estimateIsland({ ...changed, money: island.money + income }),
        commandResult: {
          success: true,
          consumeTurn: true,
          logs: [log(island, `${island.name} sold trees for ${income}.`)]
        }
      };
    }

    case "plant": {
      cell.terrain = "forest";
      cell.value = 1;
      return success(changed, cost, command, true);
    }

    case "buildFarm": {
      cell.terrain = "farm";
      cell.value = 10;
      return success(changed, cost, command, true);
    }

    case "buildFactory": {
      cell.terrain = "factory";
      cell.value = 10;
      return success(changed, cost, command, true);
    }

    case "developMine": {
      cell.value += 5;
      return success(changed, cost, command, true);
    }

    case "buildMissileBase": {
      cell.terrain = "missileBase";
      cell.value = 0;
      return success(changed, cost, command, true);
    }

    case "buildMonument": {
      cell.terrain = "monument";
      cell.value = command.arg ?? 0;
      return success(changed, cost, command, true);
    }
  }
}

function success(
  island: Island,
  cost: number,
  command: CommandPlan,
  consumeTurn: boolean,
  mode: "executed" | "started" = "executed"
): {
  island: Island;
  commandResult: CommandResult;
} {
  const nextIsland = estimateIsland({
    ...island,
    money: island.money - cost
  });

  return {
    island: nextIsland,
    commandResult: {
      success: true,
      consumeTurn,
      logs: [log(island, `${island.name} ${mode} ${command.kind}.`)]
    }
  };
}

function failure(
  island: Island,
  command: CommandPlan,
  reason: string
): {
  island: Island;
  commandResult: CommandResult;
} {
  return {
    island,
    commandResult: {
      success: false,
      consumeTurn: island.invalidCommandPolicy === "consume",
      logs: [log(island, `${island.name} failed ${command.kind}: ${reason}.`)]
    }
  };
}

function log(island: Island, message: string): TurnLog {
  return {
    islandId: island.id,
    message
  };
}

export function progressCellWork(island: Island): {
  island: Island;
  logs: TurnLog[];
} {
  const cells = cloneCells(island.cells);
  const logs: TurnLog[] = [];

  for (const row of cells) {
    for (const cell of row) {
      if (!cell.workKind || !cell.workRemaining || !cell.workTotal) continue;

      cell.workRemaining -= 1;

      if (cell.workRemaining <= 0) {
        const completed = cell.workKind;
        completeCellWork(cell);
        clearCellWork(cell);
        logs.push(log(island, `${island.name} completed ${completed} at (${cell.x}, ${cell.y}).`));
      }
    }
  }

  for (const row of cells) {
    for (const cell of row) {
      if (!cell.monsterKind || cell.monsterActionRemaining === undefined) continue;
      const previousRemaining = cell.monsterActionRemaining;
      cell.monsterActionRemaining = Math.max(0, cell.monsterActionRemaining - 1);
      if (previousRemaining > 0 && cell.monsterActionRemaining === 0) {
        logs.push(log(island, `${cell.monsterKind} is ready to act at (${cell.x}, ${cell.y}).`));
      }
    }
  }

  markCoasts(cells);
  return {
    island: estimateIsland({ ...island, cells }),
    logs
  };
}

function completeCellWork(cell: {
  terrain: string;
  value: number;
  workKind?: CommandPlan["kind"];
  workArg?: number;
}): void {
  switch (cell.workKind) {
    case "prepare":
      cell.terrain = "plains";
      cell.value = 0;
      break;
    case "reclaim":
      cell.terrain = "waste";
      cell.value = 0;
      break;
    case "destroy":
      if (cell.terrain === "mountain") {
        cell.value = 1;
      } else {
        cell.terrain = "waste";
        cell.value = 0;
      }
      break;
    case "sellTrees":
      cell.terrain = "plains";
      cell.value = 0;
      break;
    case "plant":
      cell.terrain = "forest";
      cell.value = 1;
      break;
    case "buildFarm":
      cell.terrain = "farm";
      cell.value = 10;
      break;
    case "buildFactory":
      cell.terrain = "factory";
      cell.value = 10;
      break;
    case "developMine":
      cell.value += 5;
      break;
    case "buildMissileBase":
      cell.terrain = "missileBase";
      cell.value = 0;
      break;
    case "buildMonument":
      cell.terrain = "monument";
      cell.value = cell.workArg ?? 0;
      break;
  }
}
