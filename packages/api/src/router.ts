import { advanceTurn, type CommandPlan, type GameRules, type GameState, type TurnResult } from "../../core/dist/index.js";
import { isCommandKind } from "../../db/dist/commands.js";

export interface ApiRepository {
  loadGameState(): Promise<{
    state: GameState;
    rules: GameRules;
  }>;
  saveTurnResult(result: TurnResult, rules: GameRules): Promise<void>;
  setCommand(islandId: string, position: number, command: CommandPlan): Promise<void>;
}

export interface ApiRequest {
  method: string;
  path: string;
  body?: unknown;
}

export interface ApiResponse {
  status: number;
  body: unknown;
}

export async function handleApiRequest(
  request: ApiRequest,
  repository: ApiRepository
): Promise<ApiResponse> {
  try {
    if (request.method === "GET" && request.path === "/health") {
      return json(200, { ok: true });
    }

    if (request.method === "GET" && request.path === "/state") {
      const loaded = await repository.loadGameState();
      return json(200, loaded);
    }

    if (request.method === "POST" && request.path === "/command") {
      const input = parseCommandInput(request.body);
      await repository.setCommand(input.islandId, input.position, input.command);
      return json(200, {
        ok: true,
        islandId: input.islandId,
        position: input.position,
        command: input.command
      });
    }

    if (request.method === "POST" && request.path === "/turn") {
      const loaded = await repository.loadGameState();
      const result = advanceTurn(loaded.state, { rules: loaded.rules });
      await repository.saveTurnResult(result, loaded.rules);
      return json(200, result);
    }

    return json(404, { error: "not_found" });
  } catch (error) {
    return json(400, {
      error: error instanceof Error ? error.message : "bad_request"
    });
  }
}

function parseCommandInput(body: unknown): {
  islandId: string;
  position: number;
  command: CommandPlan;
} {
  if (!isRecord(body)) throw new Error("request body must be an object");

  const islandId = stringField(body, "islandId");
  const position = integerField(body, "position");
  const kind = stringField(body, "kind");
  const x = integerField(body, "x");
  const y = integerField(body, "y");
  const arg = optionalIntegerField(body, "arg");
  const targetIslandId = optionalStringField(body, "targetIslandId");

  if (!isCommandKind(kind)) {
    throw new Error(`unknown command kind: ${kind}`);
  }

  return {
    islandId,
    position,
    command: {
      kind,
      x,
      y,
      ...(targetIslandId === undefined ? {} : { targetIslandId }),
      ...(arg === undefined ? {} : { arg })
    }
  };
}

function json(status: number, body: unknown): ApiResponse {
  return { status, body };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${key} must be a non-empty string`);
  }
  return value;
}

function optionalStringField(body: Record<string, unknown>, key: string): string | undefined {
  const value = body[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${key} must be a non-empty string when provided`);
  }
  return value;
}

function integerField(body: Record<string, unknown>, key: string): number {
  const value = body[key];
  if (!Number.isInteger(value)) {
    throw new Error(`${key} must be an integer`);
  }
  return value as number;
}

function optionalIntegerField(body: Record<string, unknown>, key: string): number | undefined {
  const value = body[key];
  if (value === undefined || value === null) return undefined;
  if (!Number.isInteger(value)) {
    throw new Error(`${key} must be an integer when provided`);
  }
  return value as number;
}
