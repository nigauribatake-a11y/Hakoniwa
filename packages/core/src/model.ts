export const ISLAND_SIZE = 12;
export const COMMAND_QUEUE_LENGTH = 40;

export type TerrainKind =
  | "sea"
  | "waste"
  | "plains"
  | "town"
  | "forest"
  | "farm"
  | "factory"
  | "mountain"
  | "missileBase"
  | "defence"
  | "monument";

export type CommandKind =
  | "doNothing"
  | "prepare"
  | "reclaim"
  | "destroy"
  | "sellTrees"
  | "plant"
  | "buildFarm"
  | "buildFactory"
  | "developMine";

export interface Cell {
  x: number;
  y: number;
  terrain: TerrainKind;
  value: number;
}

export interface CommandPlan {
  kind: CommandKind;
  x: number;
  y: number;
  targetIslandId?: string;
  arg?: number;
}

export interface Island {
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
  cells: Cell[][];
  commandQueue: CommandPlan[];
}

export interface GameState {
  turn: number;
  lastTurnAt: number;
  islands: Island[];
}

export interface TurnLog {
  islandId: string;
  message: string;
}

export interface CommandResult {
  success: boolean;
  consumeTurn: boolean;
  logs: TurnLog[];
}

export interface TurnResult {
  state: GameState;
  logs: TurnLog[];
}

export interface RandomSource {
  nextInt(maxExclusive: number): number;
}
