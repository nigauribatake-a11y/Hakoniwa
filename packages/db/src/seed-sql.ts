import {
  createGameRules,
  createInitialIsland,
  DeterministicRandom,
  type GameState
} from "../../core/dist/index.js";
import { gameStateToRows } from "./rows.js";
import { snapshotToSql } from "./sql.js";

const rules = createGameRules();
const island = createInitialIsland("1", "Alpha", new DeterministicRandom(1), rules);
const state: GameState = {
  turn: 1,
  lastTurnAt: 0,
  islands: [island]
};

process.stdout.write(snapshotToSql(gameStateToRows(state, rules)));
