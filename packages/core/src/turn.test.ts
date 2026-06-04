import assert from "node:assert/strict";
import { test } from "node:test";
import { advanceTurn } from "./turn.js";
import { createBasicIsland } from "./rules.js";
import type { GameState } from "./model.js";

test("advanceTurn executes the first valid command and shifts the queue", () => {
  const island = createBasicIsland("1", "Alpha");
  island.commandQueue[0] = { kind: "plant", x: 5, y: 6 };

  const state: GameState = {
    turn: 1,
    lastTurnAt: 0,
    islands: [island]
  };

  const result = advanceTurn(state);
  const updated = result.state.islands[0]!;

  assert.equal(result.state.turn, 2);
  assert.equal(updated.cells[6]![5]!.terrain, "forest");
  assert.equal(updated.money, 950);
  assert.equal(updated.commandQueue[39]!.kind, "doNothing");
});

test("invalid commands do not consume the turn", () => {
  const island = createBasicIsland("1", "Alpha");
  island.commandQueue[0] = { kind: "plant", x: 7, y: 6 };
  island.commandQueue[1] = { kind: "prepare", x: 6, y: 6 };

  const state: GameState = {
    turn: 1,
    lastTurnAt: 0,
    islands: [island]
  };

  const result = advanceTurn(state);
  const updated = result.state.islands[0]!;

  assert.match(result.logs[0]!.message, /failed plant/);
  assert.equal(updated.cells[6]![6]!.terrain, "plains");
  assert.equal(updated.money, 995);
});

test("reclaim converts coast sea to waste", () => {
  const island = createBasicIsland("1", "Alpha");
  island.commandQueue[0] = { kind: "reclaim", x: 5, y: 5 };

  const state: GameState = {
    turn: 1,
    lastTurnAt: 0,
    islands: [island]
  };

  const result = advanceTurn(state);
  const updated = result.state.islands[0]!;

  assert.equal(updated.cells[5]![5]!.terrain, "waste");
  assert.equal(updated.money, 850);
});
