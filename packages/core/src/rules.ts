import {
  COMMAND_QUEUE_LENGTH,
  ISLAND_SIZE,
  type Cell,
  type CommandKind,
  type CommandPlan,
  type CommandEvaluation,
  type GameRules,
  type Island,
  type MonsterActionEvaluation,
  type RandomSource,
  type TerrainKind,
  type TurnLog
} from "./model.js";

export const TURN_SECONDS = 21_600;

export const defaultGameRules: GameRules = {
  turnSeconds: TURN_SECONDS,
  smallTurnSeconds: 900,
  majorTurnEverySmallTurns: 24,
  commandQueueLength: COMMAND_QUEUE_LENGTH,
  initialMoney: 1_000,
  initialFood: 1_000,
  supportMoneyBase: 100,
  foodProductionPerFarmCapacity: 10,
  foodConsumptionPerPopulation: 100,
  moneyProductionPerIndustryCapacity: 10,
  forestGrowthPerTurn: 1,
  forestMaxValue: 20,
  townGrowthChancePer100: 35,
  townMaxValue: 50,
  starvationTownLoss: 1,
  disasterGraceTurns: 24,
  earthquakeChancePer1000: 5,
  fireChancePer1000: 5,
  tsunamiChancePer1000: 5,
  typhoonChancePer1000: 5,
  meteorChancePer1000: 5,
  eruptionChancePer1000: 5,
  initialForests: 4,
  initialTowns: 2,
  initialMountains: 1,
  initialMissileBases: 1,
  commandCosts: {
    doNothing: 0,
    prepare: 5,
    reclaim: 150,
    destroy: 200,
    sellTrees: 0,
    plant: 50,
    buildFarm: 20,
    buildFactory: 100,
    developMine: 300,
    buildMissileBase: 300,
    buildMonument: 9_999
  },
  commandDurations: {
    doNothing: 0,
    prepare: 1,
    reclaim: 4,
    destroy: 2,
    sellTrees: 1,
    plant: 2,
    buildFarm: 3,
    buildFactory: 4,
    developMine: 5,
    buildMissileBase: 6,
    buildMonument: 8
  }
};

export type GameRulesOverrides = Omit<Partial<GameRules>, "commandCosts" | "commandDurations"> & {
  commandCosts?: Partial<GameRules["commandCosts"]>;
  commandDurations?: Partial<GameRules["commandDurations"]>;
};

export function createGameRules(overrides: GameRulesOverrides = {}): GameRules {
  return {
    ...defaultGameRules,
    ...overrides,
    commandCosts: {
      ...defaultGameRules.commandCosts,
      ...overrides.commandCosts
    },
    commandDurations: {
      ...defaultGameRules.commandDurations,
      ...overrides.commandDurations
    }
  };
}

export const defaultCommand: CommandPlan = {
  kind: "doNothing",
  x: 0,
  y: 0
};

export function createEmptyCommandQueue(): CommandPlan[] {
  return Array.from({ length: COMMAND_QUEUE_LENGTH }, () => ({ ...defaultCommand }));
}

export function createSeaMap(size = ISLAND_SIZE): Cell[][] {
  return Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) => ({
      x,
      y,
      terrain: "sea" as TerrainKind,
      value: 0
    }))
  );
}

export function createBasicIsland(id: string, name: string): Island {
  const cells = createSeaMap();
  const center = Math.floor(ISLAND_SIZE / 2);

  setCell(cells, center, center, "town", 5);
  setCell(cells, center - 1, center, "plains", 0);
  setCell(cells, center + 1, center, "forest", 5);
  setCell(cells, center, center - 1, "mountain", 0);
  markCoasts(cells);

  const island: Island = {
    id,
    name,
    money: defaultGameRules.initialMoney,
    food: defaultGameRules.initialFood,
    population: 0,
    area: 0,
    score: 0,
    farmSize: 0,
    factorySize: 0,
    mineSize: 0,
    absentTurns: 0,
    invalidCommandPolicy: "skip",
    cells,
    commandQueue: createEmptyCommandQueue()
  };

  return estimateIsland(island);
}

export function createInitialIsland(
  id: string,
  name: string,
  random: RandomSource,
  rules: GameRules = defaultGameRules
): Island {
  const cells = createSeaMap();
  const center = Math.floor(ISLAND_SIZE / 2) - 1;

  for (let y = center - 1; y < center + 3; y++) {
    for (let x = center - 1; x < center + 3; x++) {
      setCell(cells, x, y, "waste", 0);
    }
  }

  for (let i = 0; i < 120; i++) {
    const x = random.nextInt(8) + center - 3;
    const y = random.nextInt(8) + center - 3;
    const cell = getCell(cells, x, y);

    if (!cell || neighbors(cells, x, y).every((neighbor) => neighbor.terrain === "sea")) {
      continue;
    }

    if (cell.terrain === "waste") {
      cell.terrain = "plains";
      cell.value = 0;
    } else if (cell.terrain === "sea" && cell.value === 1) {
      cell.terrain = "waste";
      cell.value = 0;
    } else if (cell.terrain === "sea") {
      cell.value = 1;
    }
  }

  placeRandomCells(cells, "forest", 5, rules.initialForests, random);
  placeRandomCells(cells, "town", 5, rules.initialTowns, random, ["forest"]);
  placeRandomCells(cells, "mountain", 0, rules.initialMountains, random, ["forest", "town"]);
  placeRandomCells(cells, "missileBase", 0, rules.initialMissileBases, random, [
    "forest",
    "town",
    "mountain"
  ]);
  markCoasts(cells);

  return estimateIsland({
    id,
    name,
    money: rules.initialMoney,
    food: rules.initialFood,
    population: 0,
    area: 0,
    score: 0,
    farmSize: 0,
    factorySize: 0,
    mineSize: 0,
    absentTurns: 0,
    invalidCommandPolicy: "skip",
    cells,
    commandQueue: createEmptyCommandQueue()
  });
}

export function estimateIsland(island: Island): Island {
  let population = 0;
  let area = 0;
  let farmSize = 0;
  let factorySize = 0;
  let mineSize = 0;

  for (const row of island.cells) {
    for (const cell of row) {
      if (cell.terrain !== "sea") area += 1;

      switch (cell.terrain) {
        case "town":
          population += cell.value * 100;
          break;
        case "farm":
          farmSize += cell.value;
          break;
        case "factory":
          factorySize += cell.value;
          break;
        case "mountain":
          mineSize += cell.value;
          break;
      }
    }
  }

  const score = population + island.money + Math.floor(island.food / 10) + area * 50;

  return {
    ...island,
    population,
    area,
    farmSize,
    factorySize,
    mineSize,
    score
  };
}

export function applyIncome(island: Island, rules: GameRules = defaultGameRules): Island {
  const workers = Math.floor(island.population / 100);
  const farmWorkers = Math.min(workers, island.farmSize);
  const remainingWorkers = Math.max(0, workers - farmWorkers);
  const industryCapacity = island.factorySize + island.mineSize;
  const industryWorkers = Math.min(remainingWorkers, industryCapacity);

  return {
    ...island,
    food:
      island.food +
      farmWorkers * rules.foodProductionPerFarmCapacity -
      Math.floor(island.population / rules.foodConsumptionPerPopulation),
    money: island.money + industryWorkers * rules.moneyProductionPerIndustryCapacity
  };
}

export function updateCells(
  island: Island,
  random: RandomSource,
  rules: GameRules = defaultGameRules,
  turn = 0
): {
  island: Island;
  logs: TurnLog[];
} {
  const cells = cloneCells(island.cells);
  const logs: TurnLog[] = [];
  const starving = island.food < 0;

  for (const row of cells) {
    for (const cell of row) {
      if (cell.terrain === "forest") {
        cell.value = Math.min(rules.forestMaxValue, cell.value + rules.forestGrowthPerTurn);
      }

      if (cell.terrain === "town") {
        if (starving) {
          cell.value = Math.max(0, cell.value - rules.starvationTownLoss);
        } else if (random.nextInt(100) < rules.townGrowthChancePer100) {
          cell.value = Math.min(rules.townMaxValue, cell.value + 1);
        }
      }
    }
  }

  let nextIsland = estimateIsland({
    ...island,
    cells,
    food: starving ? 0 : island.food
  });

  if (starving) {
    logs.push({
      islandId: island.id,
      message: `${island.name} suffered food shortages.`
    });
  }

  const disasterResult = applyDisasters(nextIsland, random, rules, turn);
  nextIsland = disasterResult.island;
  logs.push(...disasterResult.logs);

  return {
    island: nextIsland,
    logs
  };
}

export function applyDisasters(
  island: Island,
  random: RandomSource,
  rules: GameRules = defaultGameRules,
  turn = 0
): {
  island: Island;
  logs: TurnLog[];
} {
  const logs: TurnLog[] = [];

  if (turn <= rules.disasterGraceTurns) {
    return { island, logs };
  }

  let current = island;

  for (const disaster of [
    {
      chance: rules.earthquakeChancePer1000,
      name: "earthquake",
      terrain: "waste" as TerrainKind,
      value: 0,
      predicate: (cell: Cell) => cell.terrain !== "sea" && cell.terrain !== "defence"
    },
    {
      chance: rules.fireChancePer1000,
      name: "fire",
      terrain: "waste" as TerrainKind,
      value: 0,
      predicate: (cell: Cell) =>
        cell.terrain === "town" || cell.terrain === "forest" || cell.terrain === "factory"
    },
    {
      chance: rules.tsunamiChancePer1000,
      name: "tsunami",
      terrain: "waste" as TerrainKind,
      value: 0,
      predicate: (cell: Cell) =>
        cell.terrain !== "sea" && neighbors(current.cells, cell.x, cell.y).some(isCoast)
    },
    {
      chance: rules.typhoonChancePer1000,
      name: "typhoon",
      terrain: "plains" as TerrainKind,
      value: 0,
      predicate: (cell: Cell) => cell.terrain === "farm"
    },
    {
      chance: rules.meteorChancePer1000,
      name: "meteor",
      terrain: "sea" as TerrainKind,
      value: 0,
      predicate: () => true
    }
  ]) {
    const result = maybeApplySingleCellDisaster(
      current,
      random,
      disaster.chance,
      disaster.predicate,
      disaster.name,
      disaster.terrain,
      disaster.value
    );
    current = result.island;
    logs.push(...result.logs);
  }

  const eruption = maybeApplyEruption(current, random, rules.eruptionChancePer1000);
  current = eruption.island;
  logs.push(...eruption.logs);

  return { island: current, logs };
}

function maybeApplySingleCellDisaster(
  island: Island,
  random: RandomSource,
  chancePer1000: number,
  predicate: (cell: Cell) => boolean,
  name: string,
  resultTerrain: TerrainKind,
  resultValue: number
): {
  island: Island;
  logs: TurnLog[];
} {
  if (chancePer1000 <= 0 || random.nextInt(1000) >= chancePer1000) {
    return { island, logs: [] };
  }

  const damageableCells = island.cells
    .flat()
    .filter(predicate);

  if (damageableCells.length === 0) {
    return { island, logs: [] };
  }

  const target = damageableCells[random.nextInt(damageableCells.length)]!;
  const cells = cloneCells(island.cells);
  const cell = getCell(cells, target.x, target.y)!;
  cell.terrain = resultTerrain;
  cell.value = resultValue;
  markCoasts(cells);

  return {
    island: estimateIsland({
      ...island,
      cells
    }),
    logs: [
      {
        islandId: island.id,
        message: `${island.name} was hit by ${name} at (${target.x}, ${target.y}).`
      }
    ]
  };
}

function maybeApplyEruption(
  island: Island,
  random: RandomSource,
  chancePer1000: number
): {
  island: Island;
  logs: TurnLog[];
} {
  if (chancePer1000 <= 0 || random.nextInt(1000) >= chancePer1000) {
    return { island, logs: [] };
  }

  const x = random.nextInt(island.cells[0]?.length ?? ISLAND_SIZE);
  const y = random.nextInt(island.cells.length);
  const cells = cloneCells(island.cells);
  const center = getCell(cells, x, y);

  if (!center) {
    return { island, logs: [] };
  }

  center.terrain = "mountain";
  center.value = 0;

  for (const neighbor of neighbors(cells, x, y)) {
    if (neighbor.terrain === "sea" && neighbor.value === 0) {
      neighbor.value = 1;
    } else if (neighbor.terrain !== "sea" && neighbor.terrain !== "mountain") {
      neighbor.terrain = "waste";
      neighbor.value = 0;
    }
  }

  markCoasts(cells);

  return {
    island: estimateIsland({ ...island, cells }),
    logs: [
      {
        islandId: island.id,
        message: `${island.name} had an eruption at (${x}, ${y}).`
      }
    ]
  };
}

export function setCell(
  cells: Cell[][],
  x: number,
  y: number,
  terrain: TerrainKind,
  value: number
): void {
  cells[y]![x] = { x, y, terrain, value };
}

export function getCell(cells: Cell[][], x: number, y: number): Cell | undefined {
  return cells[y]?.[x];
}

export function cloneCells(cells: Cell[][]): Cell[][] {
  return cells.map((row) => row.map((cell) => ({ ...cell })));
}

export function clearCellWork(cell: Cell): void {
  delete cell.workKind;
  delete cell.workRemaining;
  delete cell.workTotal;
  delete cell.workArg;
}

export function evaluateCommand(
  island: Island,
  command: CommandPlan,
  rules: GameRules = defaultGameRules
): CommandEvaluation {
  const cost = rules.commandCosts[command.kind];
  const duration = rules.commandDurations[command.kind];
  const cell = getCell(island.cells, command.x, command.y);

  if (command.kind === "doNothing") {
    return { command: command.kind, cost, duration, canExecute: true };
  }

  if (island.money < cost) {
    return { command: command.kind, cost, duration, canExecute: false, reason: "資金が不足しています" };
  }

  if (!cell) {
    return { command: command.kind, cost, duration, canExecute: false, reason: "範囲外の座標です" };
  }

  if (cell.workKind) {
    return { command: command.kind, cost, duration, canExecute: false, reason: "このセルは作業中です" };
  }

  const reason = commandFailureReason(cell, command);
  return {
    command: command.kind,
    cost,
    duration,
    canExecute: reason === undefined,
    ...(reason === undefined ? {} : { reason })
  };
}

export function commandFailureReason(cell: Cell, command: CommandPlan): string | undefined {
  switch (command.kind) {
    case "doNothing":
      return undefined;
    case "prepare":
      return cell.terrain === "sea" || cell.terrain === "mountain"
        ? "この地形は整地できません"
        : undefined;
    case "reclaim":
      return !isCoast(cell) ? "埋め立ては浅瀬のみ可能です" : undefined;
    case "destroy":
      return cell.terrain === "sea" ? "海は掘削できません" : undefined;
    case "sellTrees":
      return cell.terrain !== "forest" ? "伐採は森のみ可能です" : undefined;
    case "plant":
      return cell.terrain !== "plains" && cell.terrain !== "waste"
        ? "植林は平地または荒地のみ可能です"
        : undefined;
    case "buildFarm":
      return cell.terrain !== "plains" && cell.terrain !== "waste"
        ? "農場は平地または荒地のみ建設できます"
        : undefined;
    case "buildFactory":
      return cell.terrain !== "plains" && cell.terrain !== "waste"
        ? "工場は平地または荒地のみ建設できます"
        : undefined;
    case "developMine":
      return cell.terrain !== "mountain" ? "採掘場整備は山のみ可能です" : undefined;
    case "buildMissileBase":
      return cell.terrain !== "plains" && cell.terrain !== "waste"
        ? "ミサイル基地は平地または荒地のみ建設できます"
        : undefined;
    case "buildMonument":
      return cell.terrain !== "plains" && cell.terrain !== "waste"
        ? "記念碑は平地または荒地のみ建設できます"
        : undefined;
  }
}

export function evaluateMonsterAction(cell: Cell): MonsterActionEvaluation {
  if (!cell.monsterKind) {
    return {
      canAct: false,
      remainingTurns: 0,
      totalTurns: 0,
      reason: "怪獣がいません"
    };
  }

  const remainingTurns = cell.monsterActionRemaining ?? 0;
  const totalTurns = cell.monsterActionTotal ?? 0;

  return {
    canAct: remainingTurns <= 0,
    remainingTurns,
    totalTurns,
    ...(remainingTurns <= 0 ? {} : { reason: "行動準備中です" })
  };
}

export function shiftCommandQueue(queue: CommandPlan[]): {
  command: CommandPlan;
  queue: CommandPlan[];
} {
  const [command = defaultCommand, ...rest] = queue;
  return {
    command,
    queue: [...rest, { ...defaultCommand }].slice(0, COMMAND_QUEUE_LENGTH)
  };
}

export function isLandTerrain(terrain: TerrainKind): boolean {
  return terrain !== "sea";
}

export function isCoast(cell: Cell): boolean {
  return cell.terrain === "sea" && cell.value === 1;
}

export function markCoasts(cells: Cell[][]): void {
  const seaCells = cells.flat().filter((cell) => cell.terrain === "sea");

  for (const cell of seaCells) {
    const touchesLand = neighbors(cells, cell.x, cell.y).some((neighbor) =>
      isLandTerrain(neighbor.terrain)
    );
    cell.value = touchesLand ? 1 : 0;
  }
}

export function neighbors(cells: Cell[][], x: number, y: number): Cell[] {
  const evenRowDeltas = [
    [0, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [0, 1],
    [1, 1]
  ];
  const oddRowDeltas = [
    [-1, -1],
    [0, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [0, 1]
  ];

  return (y % 2 === 0 ? evenRowDeltas : oddRowDeltas)
    .map(([dx, dy]) => getCell(cells, x + dx, y + dy))
    .filter((cell): cell is Cell => cell !== undefined);
}

function placeRandomCells(
  cells: Cell[][],
  terrain: TerrainKind,
  value: number,
  count: number,
  random: RandomSource,
  excludedTerrains: TerrainKind[] = []
): void {
  const center = Math.floor(ISLAND_SIZE / 2) - 1;
  let placed = 0;
  const candidates = cells
    .flat()
    .filter(
      (cell) =>
        cell.x >= center - 1 &&
        cell.x < center + 3 &&
        cell.y >= center - 1 &&
        cell.y < center + 3 &&
        cell.terrain !== "sea" &&
        cell.terrain !== terrain &&
        !excludedTerrains.includes(cell.terrain)
    );

  while (placed < count && candidates.length > 0) {
    const [cell] = candidates.splice(random.nextInt(candidates.length), 1);
    if (!cell) continue;

    cell.terrain = terrain;
    cell.value = value;
    placed += 1;
  }
}
