import assert from "node:assert/strict";
import { test } from "node:test";
import { advanceTurn, DeterministicRandom } from "./turn.js";
import { createBasicIsland, createGameRules, createInitialIsland, evaluateMonsterAction } from "./rules.js";
import type { GameState, RandomSource } from "./model.js";

class SequenceRandom implements RandomSource {
  private index = 0;

  constructor(private readonly values: number[]) {}

  nextInt(maxExclusive: number): number {
    const value = this.values[this.index++] ?? maxExclusive - 1;
    return Math.max(0, Math.min(maxExclusive - 1, value));
  }
}

const noDisasterRules = createGameRules({
  majorTurnEverySmallTurns: 1,
  earthquakeChancePer1000: 0,
  fireChancePer1000: 0,
  tsunamiChancePer1000: 0,
  typhoonChancePer1000: 0,
  meteorChancePer1000: 0,
  eruptionChancePer1000: 0,
  commandDurations: {
    prepare: 1,
    reclaim: 1,
    destroy: 1,
    sellTrees: 1,
    plant: 1,
    buildFarm: 1,
    buildFactory: 1,
    developMine: 1,
    buildMissileBase: 1,
    buildMonument: 1
  }
});

test("advanceTurn executes the first valid command and shifts the queue", () => {
  const island = createBasicIsland("1", "Alpha");
  island.commandQueue[0] = { kind: "plant", x: 5, y: 6 };

  const state: GameState = {
    turn: 1,
    lastTurnAt: 0,
    islands: [island]
  };

  const result = advanceTurn(state, { rules: noDisasterRules });
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

  const result = advanceTurn(state, { rules: noDisasterRules });
  const updated = result.state.islands[0]!;

  assert.match(result.logs[0]!.message, /failed plant/);
  assert.equal(updated.cells[6]![6]!.terrain, "plains");
  assert.equal(updated.money, 995);
});

test("invalid command policy can consume the turn", () => {
  const island = createBasicIsland("1", "Alpha");
  island.invalidCommandPolicy = "consume";
  island.commandQueue[0] = { kind: "plant", x: 7, y: 6 };
  island.commandQueue[1] = { kind: "prepare", x: 6, y: 6 };

  const state: GameState = {
    turn: 1,
    lastTurnAt: 0,
    islands: [island]
  };

  const result = advanceTurn(state, { rules: noDisasterRules });
  const updated = result.state.islands[0]!;

  assert.match(result.logs[0]!.message, /failed plant/);
  assert.equal(updated.cells[6]![6]!.terrain, "town");
  assert.equal(updated.commandQueue[0]!.kind, "prepare");
});

test("reclaim converts coast sea to waste", () => {
  const island = createBasicIsland("1", "Alpha");
  island.commandQueue[0] = { kind: "reclaim", x: 5, y: 5 };

  const state: GameState = {
    turn: 1,
    lastTurnAt: 0,
    islands: [island]
  };

  const result = advanceTurn(state, { rules: noDisasterRules });
  const updated = result.state.islands[0]!;

  assert.equal(updated.cells[5]![5]!.terrain, "waste");
  assert.equal(updated.money, 850);
});

test("build missile base converts plains to missile base", () => {
  const island = createBasicIsland("1", "Alpha");
  island.commandQueue[0] = { kind: "buildMissileBase", x: 5, y: 6 };

  const state: GameState = {
    turn: 1,
    lastTurnAt: 0,
    islands: [island]
  };

  const result = advanceTurn(state, { rules: noDisasterRules });
  const updated = result.state.islands[0]!;

  assert.equal(updated.cells[6]![5]!.terrain, "missileBase");
  assert.equal(updated.cells[6]![5]!.value, 0);
  assert.equal(updated.money, 700);
});

test("build monument stores the monument kind in cell value", () => {
  const island = createBasicIsland("1", "Alpha");
  island.money = 10_000;
  island.commandQueue[0] = { kind: "buildMonument", x: 5, y: 6, arg: 3 };

  const state: GameState = {
    turn: 1,
    lastTurnAt: 0,
    islands: [island]
  };

  const result = advanceTurn(state, { rules: noDisasterRules });
  const updated = result.state.islands[0]!;

  assert.equal(updated.cells[6]![5]!.terrain, "monument");
  assert.equal(updated.cells[6]![5]!.value, 3);
  assert.equal(updated.money, 1);
});

test("food shortage shrinks towns and resets food to zero", () => {
  const island = createBasicIsland("1", "Alpha");
  island.food = 0;
  island.commandQueue[0] = { kind: "doNothing", x: 0, y: 0 };

  const state: GameState = {
    turn: 1,
    lastTurnAt: 0,
    islands: [island]
  };

  const result = advanceTurn(state, {
    random: new SequenceRandom([999]),
    rules: noDisasterRules
  });
  const updated = result.state.islands[0]!;

  assert.equal(updated.food, 0);
  assert.equal(updated.cells[6]![6]!.value, 4);
  assert.match(result.logs.at(-1)!.message, /food shortages/);
});

test("earthquake damages one non-sea cell when disaster roll triggers", () => {
  const island = createBasicIsland("1", "Alpha");
  island.commandQueue[0] = { kind: "doNothing", x: 0, y: 0 };

  const state: GameState = {
    turn: 1,
    lastTurnAt: 0,
    islands: [island]
  };

  const result = advanceTurn(state, {
    random: new SequenceRandom([99, 0, 0, 999, 999, 999, 999, 999]),
    rules: createGameRules({
      majorTurnEverySmallTurns: 1,
      disasterGraceTurns: 0
    })
  });
  const updated = result.state.islands[0]!;

  assert.equal(updated.cells[5]![6]!.terrain, "waste");
  assert.match(result.logs.at(-1)!.message, /earthquake/);
});

test("disasters do not occur during the grace turns", () => {
  const island = createBasicIsland("1", "Alpha");
  island.commandQueue[0] = { kind: "doNothing", x: 0, y: 0 };

  const result = advanceTurn(
    {
      turn: 1,
      lastTurnAt: 0,
      islands: [island]
    },
    {
      random: new SequenceRandom([99, 0, 0, 0, 0, 0, 0, 0]),
      rules: createGameRules({
        majorTurnEverySmallTurns: 1,
        disasterGraceTurns: 10,
        earthquakeChancePer1000: 1000,
        fireChancePer1000: 1000,
        tsunamiChancePer1000: 1000,
        typhoonChancePer1000: 1000,
        meteorChancePer1000: 1000,
        eruptionChancePer1000: 1000
      })
    }
  );

  assert.equal(
    result.logs.some((entry) =>
      /earthquake|fire|tsunami|typhoon|meteor|eruption/.test(entry.message)
    ),
    false
  );
});

test("initial island generation creates several core terrains", () => {
  const island = createInitialIsland(
    "1",
    "Alpha",
    new DeterministicRandom(123)
  );
  const terrains = island.cells.flat().map((cell) => cell.terrain);

  assert.equal(terrains.filter((terrain) => terrain === "town").length, 2);
  assert.equal(terrains.filter((terrain) => terrain === "forest").length, 4);
  assert.equal(terrains.filter((terrain) => terrain === "mountain").length, 1);
  assert.equal(terrains.filter((terrain) => terrain === "missileBase").length, 1);
});

test("rules can override turn time and command costs", () => {
  const island = createBasicIsland("1", "Alpha");
  island.commandQueue[0] = { kind: "plant", x: 5, y: 6 };

  const state: GameState = {
    turn: 1,
    lastTurnAt: 10,
    islands: [island]
  };

  const result = advanceTurn(state, {
    rules: createGameRules({
      ...noDisasterRules,
      smallTurnSeconds: 60,
      commandCosts: {
        plant: 7
      }
    })
  });

  const updated = result.state.islands[0]!;

  assert.equal(result.state.lastTurnAt, 70);
  assert.equal(updated.money, 993);
});

test("commands can take multiple small turns before completion", () => {
  const rules = createGameRules({
    ...noDisasterRules,
    majorTurnEverySmallTurns: 99,
    commandDurations: {
      plant: 2
    }
  });
  const island = createBasicIsland("1", "Alpha");
  island.commandQueue[0] = { kind: "plant", x: 5, y: 6 };

  const first = advanceTurn(
    {
      turn: 1,
      lastTurnAt: 0,
      islands: [island]
    },
    { rules }
  );
  const firstIsland = first.state.islands[0]!;

  assert.equal(firstIsland.cells[6]![5]!.terrain, "plains");
  assert.equal(firstIsland.cells[6]![5]!.workKind, "plant");
  assert.equal(firstIsland.cells[6]![5]!.workRemaining, 1);

  const second = advanceTurn(first.state, { rules });
  const secondIsland = second.state.islands[0]!;

  assert.equal(secondIsland.cells[6]![5]!.terrain, "forest");
  assert.equal(secondIsland.cells[6]![5]!.workKind, undefined);
});

test("monster action state is stored on cells and counts down", () => {
  const island = createBasicIsland("1", "Alpha");
  const cell = island.cells[6]![6]!;
  cell.monsterKind = "testMonster";
  cell.monsterActionRemaining = 1;
  cell.monsterActionTotal = 3;

  assert.equal(evaluateMonsterAction(cell).canAct, false);

  const result = advanceTurn(
    {
      turn: 1,
      lastTurnAt: 0,
      islands: [island]
    },
    { rules: noDisasterRules }
  );
  const updatedCell = result.state.islands[0]!.cells[6]![6]!;

  assert.equal(updatedCell.monsterActionRemaining, 0);
  assert.equal(evaluateMonsterAction(updatedCell).canAct, true);
  assert.equal(result.logs.some((entry) => /ready to act/.test(entry.message)), true);
});

test("rules can disable all disasters", () => {
  const island = createBasicIsland("1", "Alpha");
  island.commandQueue[0] = { kind: "doNothing", x: 0, y: 0 };

  const result = advanceTurn(
    {
      turn: 1,
      lastTurnAt: 0,
      islands: [island]
    },
    {
      random: new SequenceRandom([0, 0, 0, 0, 0, 0, 0]),
      rules: noDisasterRules
    }
  );

  assert.equal(
    result.logs.some((entry) =>
      /earthquake|fire|tsunami|typhoon|meteor|eruption/.test(entry.message)
    ),
    false
  );
});
