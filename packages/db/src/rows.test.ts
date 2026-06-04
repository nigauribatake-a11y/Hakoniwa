import assert from "node:assert/strict";
import { test } from "node:test";
import {
  advanceTurn,
  createGameRules,
  createInitialIsland,
  DeterministicRandom,
  type GameState
} from "../../core/dist/index.js";
import { InMemoryGameRepository } from "./repository.js";
import { gameStateToRows, rowsToGameState } from "./rows.js";

test("serializes and restores game state rows", () => {
  const rules = createGameRules({ disasterGraceTurns: 10 });
  const island = createInitialIsland("1", "Alpha", new DeterministicRandom(1), rules);
  island.commandQueue[0] = { kind: "buildMonument", x: 5, y: 6, arg: 3 };
  island.invalidCommandPolicy = "consume";
  const state: GameState = {
    turn: 1,
    lastTurnAt: 0,
    islands: [island]
  };

  const rows = gameStateToRows(state, rules);
  const restored = rowsToGameState(rows);

  assert.deepEqual(restored.state, state);
  assert.deepEqual(restored.rules, rules);
});

test("repository saves turn result and appends logs", async () => {
  const rules = createGameRules({
    disasterGraceTurns: 100,
    commandCosts: {
      plant: 7
    }
  });
  const island = createInitialIsland("1", "Alpha", new DeterministicRandom(1), rules);
  island.commandQueue[0] = { kind: "plant", x: 5, y: 6 };
  const repository = new InMemoryGameRepository(
    {
      turn: 1,
      lastTurnAt: 0,
      islands: [island]
    },
    rules
  );

  const loaded = await repository.loadGameState();
  const result = advanceTurn(loaded.state, { rules: loaded.rules });
  await repository.saveTurnResult(result, loaded.rules);
  const saved = await repository.loadGameState();

  assert.equal(saved.state.turn, 2);
  assert.equal(repository.getTurnLogs().length > 0, true);
});
