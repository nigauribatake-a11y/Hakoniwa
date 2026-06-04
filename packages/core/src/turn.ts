import {
  type CommandPlan,
  type CommandResult,
  type GameState,
  type Island,
  type RandomSource,
  type TurnLog,
  type TurnResult
} from "./model.js";
import {
  TURN_SECONDS,
  applyIncome,
  cloneCells,
  commandCosts,
  estimateIsland,
  getCell,
  isCoast,
  markCoasts,
  shiftCommandQueue,
  updateCells
} from "./rules.js";

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
  random: RandomSource = new DeterministicRandom(state.turn + 1)
): TurnResult {
  const logs: TurnLog[] = [];
  const islands = state.islands.map((island) => {
    let current = applyIncome(estimateIsland(island));

    while (true) {
      const result = executeNextCommand(current);
      current = result.island;
      logs.push(...result.commandResult.logs);

      if (result.commandResult.consumeTurn) break;
    }

    current = updateCells(current, random);
    return estimateIsland(current);
  });

  return {
    state: {
      ...state,
      turn: state.turn + 1,
      lastTurnAt: state.lastTurnAt + TURN_SECONDS,
      islands
    },
    logs
  };
}

export function executeNextCommand(island: Island): {
  island: Island;
  commandResult: CommandResult;
} {
  const { command, queue } = shiftCommandQueue(island.commandQueue);
  const baseIsland = { ...island, commandQueue: queue };
  const result = executeCommand(baseIsland, command);

  return {
    island: result.island,
    commandResult: result.commandResult
  };
}

export function executeCommand(
  island: Island,
  command: CommandPlan
): {
  island: Island;
  commandResult: CommandResult;
} {
  if (command.kind === "doNothing") {
    return {
      island: {
        ...island,
        absentTurns: island.absentTurns + 1,
        money: island.money + 100
      },
      commandResult: {
        success: true,
        consumeTurn: true,
        logs: [log(island, `${island.name} did nothing and received support funds.`)]
      }
    };
  }

  const cost = commandCosts[command.kind];
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

  switch (command.kind) {
    case "prepare": {
      if (cell.terrain === "sea" || cell.terrain === "mountain") {
        return failure(island, command, "cannot prepare this terrain");
      }

      cell.terrain = "plains";
      cell.value = 0;
      return success(changed, cost, command, true);
    }

    case "reclaim": {
      if (!isCoast(cell)) {
        return failure(island, command, "can only reclaim coast sea");
      }

      cell.terrain = "waste";
      cell.value = 0;
      markCoasts(cells);
      return success(changed, cost, command, true);
    }

    case "destroy": {
      if (cell.terrain === "sea") {
        return failure(island, command, "cannot destroy sea");
      }

      if (cell.terrain === "mountain") {
        cell.value = 1;
      } else {
        cell.terrain = "waste";
        cell.value = 0;
      }

      return success(changed, cost, command, true);
    }

    case "sellTrees": {
      if (cell.terrain !== "forest") {
        return failure(island, command, "can only sell trees from forest");
      }

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
      if (cell.terrain !== "plains" && cell.terrain !== "waste") {
        return failure(island, command, "can only plant on plains or waste");
      }

      cell.terrain = "forest";
      cell.value = 1;
      return success(changed, cost, command, true);
    }

    case "buildFarm": {
      if (cell.terrain !== "plains" && cell.terrain !== "waste") {
        return failure(island, command, "can only build farm on plains or waste");
      }

      cell.terrain = "farm";
      cell.value = 10;
      return success(changed, cost, command, true);
    }

    case "buildFactory": {
      if (cell.terrain !== "plains" && cell.terrain !== "waste") {
        return failure(island, command, "can only build factory on plains or waste");
      }

      cell.terrain = "factory";
      cell.value = 10;
      return success(changed, cost, command, true);
    }

    case "developMine": {
      if (cell.terrain !== "mountain") {
        return failure(island, command, "can only develop mines on mountain");
      }

      cell.value += 5;
      return success(changed, cost, command, true);
    }
  }
}

function success(
  island: Island,
  cost: number,
  command: CommandPlan,
  consumeTurn: boolean
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
      logs: [log(island, `${island.name} executed ${command.kind}.`)]
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
      consumeTurn: false,
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
