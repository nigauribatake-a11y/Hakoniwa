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
  | "developMine"
  | "buildMissileBase"
  | "buildMonument";

export interface Cell {
  x: number;
  y: number;
  terrain: TerrainKind;
  value: number;
  workKind?: CommandKind;
  workRemaining?: number;
  workTotal?: number;
  workArg?: number;
  monsterKind?: string;
  monsterActionRemaining?: number;
  monsterActionTotal?: number;
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
  invalidCommandPolicy: "skip" | "consume";
  cells: Cell[][];
  commandQueue: CommandPlan[];
}

export interface GameState {
  turn: number;
  lastTurnAt: number;
  islands: Island[];
}

export interface GameRules {
  turnSeconds: number;
  commandQueueLength: number;
  commandCosts: Record<CommandKind, number>;
  commandDurations: Record<CommandKind, number>;
}

export interface StateResponse {
  state: GameState;
  rules: GameRules;
}

export interface TurnResult {
  state: GameState;
  logs: Array<{
    islandId: string;
    message: string;
  }>;
}

export interface CommandEvaluation {
  command: CommandKind;
  cost: number;
  duration: number;
  canExecute: boolean;
  reason?: string;
}

export interface LogsResponse {
  logs: Array<{
    id: number;
    turn: number;
    islandId: string;
    message: string;
  }>;
}
