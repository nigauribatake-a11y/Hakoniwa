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
  | "developMine"
  | "buildMissileBase"
  | "buildMonument";

export type InvalidCommandPolicy = "skip" | "consume";

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
  invalidCommandPolicy: InvalidCommandPolicy;
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

export interface GameRules {
  turnSeconds: number;
  commandQueueLength: number;
  initialMoney: number;
  initialFood: number;
  supportMoneyBase: number;
  foodProductionPerFarmCapacity: number;
  foodConsumptionPerPopulation: number;
  moneyProductionPerIndustryCapacity: number;
  forestGrowthPerTurn: number;
  forestMaxValue: number;
  townGrowthChancePer100: number;
  townMaxValue: number;
  starvationTownLoss: number;
  disasterGraceTurns: number;
  earthquakeChancePer1000: number;
  fireChancePer1000: number;
  tsunamiChancePer1000: number;
  typhoonChancePer1000: number;
  meteorChancePer1000: number;
  eruptionChancePer1000: number;
  initialForests: number;
  initialTowns: number;
  initialMountains: number;
  initialMissileBases: number;
  commandCosts: Record<CommandKind, number>;
}
