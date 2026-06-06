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
import { snapshotToSql } from "./sql.js";

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

test("restores old rules json with new default rule fields", () => {
  const rules = createGameRules();
  const island = createInitialIsland("1", "Alpha", new DeterministicRandom(1), rules);
  const rows = gameStateToRows(
    {
      turn: 1,
      lastTurnAt: 0,
      islands: [island]
    },
    rules
  );
  const oldRules = JSON.parse(rows.gameState.rulesJson) as Record<string, unknown>;
  delete oldRules.commandDurations;
  delete oldRules.smallTurnSeconds;
  delete oldRules.majorTurnEverySmallTurns;
  rows.gameState.rulesJson = JSON.stringify(oldRules);

  const restored = rowsToGameState(rows);

  assert.equal(restored.rules.commandDurations.plant, 2);
  assert.equal(restored.rules.smallTurnSeconds, 900);
  assert.equal(restored.rules.majorTurnEverySmallTurns, 24);
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

test("creates snapshot SQL for psql seeding", () => {
  const rules = createGameRules();
  const island = createInitialIsland("1", "Alpha", new DeterministicRandom(1), rules);
  const sql = snapshotToSql(
    gameStateToRows(
      {
        turn: 1,
        lastTurnAt: 0,
        islands: [island]
      },
      rules
    )
  );

  assert.equal(sql.includes("insert into game_state"), true);
  assert.equal(sql.includes("insert into islands"), true);
  assert.equal(sql.includes("insert into island_cells"), true);
  assert.equal(sql.includes("insert into command_queue"), true);
});
