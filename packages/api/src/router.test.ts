import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createBasicIsland,
  createGameRules,
  type CommandPlan,
  type GameRules,
  type GameState,
  type TurnResult
} from "../../core/dist/index.js";
import { handleApiRequest, type ApiRepository } from "./router.js";

class FakeRepository implements ApiRepository {
  state: GameState = {
    turn: 1,
    lastTurnAt: 0,
    islands: [createBasicIsland("1", "Alpha")]
  };
  rules: GameRules = createGameRules({
    earthquakeChancePer1000: 0,
    fireChancePer1000: 0,
    tsunamiChancePer1000: 0,
    typhoonChancePer1000: 0,
    meteorChancePer1000: 0,
    eruptionChancePer1000: 0
  });
  command?: {
    islandId: string;
    position: number;
    command: CommandPlan;
  };
  logs = [{ id: 1, turn: 1, islandId: "1", message: "Alpha started plant." }];

  async loadGameState(): Promise<{ state: GameState; rules: GameRules }> {
    return { state: this.state, rules: this.rules };
  }

  async saveTurnResult(result: TurnResult): Promise<void> {
    this.state = result.state;
  }

  async setCommand(islandId: string, position: number, command: CommandPlan): Promise<void> {
    this.command = { islandId, position, command };
  }

  async loadTurnLogs(): Promise<Array<{ id: number; turn: number; islandId: string; message: string }>> {
    return this.logs;
  }
}

test("GET /state returns loaded game state", async () => {
  const repository = new FakeRepository();
  const response = await handleApiRequest(
    { method: "GET", path: "/state" },
    repository
  );

  assert.equal(response.status, 200);
  assert.equal((response.body as { state: GameState }).state.turn, 1);
});

test("POST /command validates and saves queue slot", async () => {
  const repository = new FakeRepository();
  const response = await handleApiRequest(
    {
      method: "POST",
      path: "/command",
      body: { islandId: "1", position: 0, kind: "plant", x: 5, y: 6 }
    },
    repository
  );

  assert.equal(response.status, 200);
  assert.deepEqual(repository.command, {
    islandId: "1",
    position: 0,
    command: { kind: "plant", x: 5, y: 6 }
  });
});

test("POST /turn advances and saves state", async () => {
  const repository = new FakeRepository();
  const response = await handleApiRequest(
    { method: "POST", path: "/turn" },
    repository
  );

  assert.equal(response.status, 200);
  assert.equal(repository.state.turn, 2);
});

test("POST /command rejects unknown command", async () => {
  const repository = new FakeRepository();
  const response = await handleApiRequest(
    {
      method: "POST",
      path: "/command",
      body: { islandId: "1", position: 0, kind: "bad", x: 5, y: 6 }
    },
    repository
  );

  assert.equal(response.status, 400);
});

test("GET /logs returns stored turn logs", async () => {
  const repository = new FakeRepository();
  const response = await handleApiRequest(
    { method: "GET", path: "/logs" },
    repository
  );

  assert.equal(response.status, 200);
  assert.equal((response.body as { logs: unknown[] }).logs.length, 1);
});

test("POST /command/evaluate returns cost and condition result", async () => {
  const repository = new FakeRepository();
  const response = await handleApiRequest(
    {
      method: "POST",
      path: "/command/evaluate",
      body: { islandId: "1", kind: "plant", x: 5, y: 6 }
    },
    repository
  );

  assert.equal(response.status, 200);
  assert.equal((response.body as { canExecute: boolean }).canExecute, true);
});
