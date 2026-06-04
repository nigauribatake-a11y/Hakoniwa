import {
  COMMAND_QUEUE_LENGTH,
  ISLAND_SIZE,
  type Cell,
  type CommandKind,
  type CommandPlan,
  type Island,
  type RandomSource,
  type TerrainKind
} from "./model.js";

export const TURN_SECONDS = 21_600;

export const commandCosts: Record<CommandKind, number> = {
  doNothing: 0,
  prepare: 5,
  reclaim: 150,
  destroy: 200,
  sellTrees: 0,
  plant: 50,
  buildFarm: 20,
  buildFactory: 100,
  developMine: 300
};

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
    money: 1_000,
    food: 1_000,
    population: 0,
    area: 0,
    score: 0,
    farmSize: 0,
    factorySize: 0,
    mineSize: 0,
    absentTurns: 0,
    cells,
    commandQueue: createEmptyCommandQueue()
  };

  return estimateIsland(island);
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

export function applyIncome(island: Island): Island {
  const workers = Math.floor(island.population / 100);
  const farmWorkers = Math.min(workers, island.farmSize);
  const remainingWorkers = Math.max(0, workers - farmWorkers);
  const industryCapacity = island.factorySize + island.mineSize;
  const industryWorkers = Math.min(remainingWorkers, industryCapacity);

  return {
    ...island,
    food: island.food + farmWorkers * 10 - Math.floor(island.population / 100),
    money: island.money + industryWorkers * 10
  };
}

export function updateCells(island: Island, random: RandomSource): Island {
  const cells = cloneCells(island.cells);

  for (const row of cells) {
    for (const cell of row) {
      if (cell.terrain === "forest") {
        cell.value = Math.min(20, cell.value + 1);
      }

      if (cell.terrain === "town" && island.food >= 0 && random.nextInt(100) < 35) {
        cell.value = Math.min(50, cell.value + 1);
      }
    }
  }

  return estimateIsland({ ...island, cells });
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
