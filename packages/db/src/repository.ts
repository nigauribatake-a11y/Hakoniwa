import type { GameRules, GameState, TurnResult } from "../../core/src/index.js";
import {
  gameStateToRows,
  logsToRows,
  rowsToGameState,
  type GameStateRows,
  type TurnLogRow
} from "./rows.js";

export interface LoadedGameState {
  state: GameState;
  rules: GameRules;
}

export interface GameRepository {
  loadGameState(): Promise<LoadedGameState>;
  saveTurnResult(result: TurnResult, rules: GameRules): Promise<void>;
}

export class InMemoryGameRepository implements GameRepository {
  private rows: GameStateRows;
  private turnLogs: TurnLogRow[] = [];

  constructor(initialState: GameState, initialRules: GameRules) {
    this.rows = gameStateToRows(initialState, initialRules);
  }

  async loadGameState(): Promise<LoadedGameState> {
    return rowsToGameState(this.rows);
  }

  async saveTurnResult(result: TurnResult, rules: GameRules): Promise<void> {
    this.rows = gameStateToRows(result.state, rules);
    this.turnLogs.push(
      ...logsToRows(result.state.turn, result.logs, this.turnLogs.length + 1)
    );
  }

  getRows(): GameStateRows {
    return structuredClone(this.rows) as GameStateRows;
  }

  getTurnLogs(): TurnLogRow[] {
    return structuredClone(this.turnLogs) as TurnLogRow[];
  }
}
