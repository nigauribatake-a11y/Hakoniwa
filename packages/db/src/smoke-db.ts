import {
  advanceTurn,
  createBasicIsland,
  createGameRules,
  type CommandPlan,
  type GameState,
  type Island,
  type TerrainKind
} from "../../core/dist/index.js";
import { PostgresGameRepository } from "./postgres.js";

interface Scenario {
  name: string;
  command: CommandPlan;
  expected: {
    x: number;
    y: number;
    terrain: TerrainKind;
    value: number;
  };
  setup?: (island: Island) => void;
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  process.stderr.write("DATABASE_URL is required.\n");
  process.exitCode = 1;
} else {
  const repository = PostgresGameRepository.fromConnectionString(databaseUrl);
  const rules = createGameRules({
    disasterGraceTurns: 100,
    earthquakeChancePer1000: 0,
    fireChancePer1000: 0,
    tsunamiChancePer1000: 0,
    typhoonChancePer1000: 0,
    meteorChancePer1000: 0,
    eruptionChancePer1000: 0
  });

  const scenarios: Scenario[] = [
    {
      name: "plant",
      command: { kind: "plant", x: 5, y: 6 },
      expected: { x: 5, y: 6, terrain: "forest", value: 2 }
    },
    {
      name: "prepare",
      command: { kind: "prepare", x: 7, y: 6 },
      expected: { x: 7, y: 6, terrain: "plains", value: 0 }
    },
    {
      name: "buildFarm",
      command: { kind: "buildFarm", x: 5, y: 6 },
      expected: { x: 5, y: 6, terrain: "farm", value: 10 }
    },
    {
      name: "buildFactory",
      command: { kind: "buildFactory", x: 5, y: 6 },
      expected: { x: 5, y: 6, terrain: "factory", value: 10 }
    },
    {
      name: "developMine",
      command: { kind: "developMine", x: 6, y: 5 },
      expected: { x: 6, y: 5, terrain: "mountain", value: 5 }
    },
    {
      name: "reclaim",
      command: { kind: "reclaim", x: 5, y: 5 },
      expected: { x: 5, y: 5, terrain: "waste", value: 0 }
    },
    {
      name: "buildMissileBase",
      command: { kind: "buildMissileBase", x: 5, y: 6 },
      expected: { x: 5, y: 6, terrain: "missileBase", value: 0 }
    },
    {
      name: "buildMonument",
      command: { kind: "buildMonument", x: 5, y: 6, arg: 3 },
      expected: { x: 5, y: 6, terrain: "monument", value: 3 },
      setup: (island) => {
        island.money = 10_000;
      }
    }
  ];

  try {
    for (const scenario of scenarios) {
      const island = createBasicIsland("1", "Alpha");
      scenario.setup?.(island);
      const state: GameState = {
        turn: 1,
        lastTurnAt: 0,
        islands: [island]
      };

      await repository.saveGameState(state, rules, { clearLogs: true });
      await repository.setCommand("1", 0, scenario.command);
      const loaded = await repository.loadGameState();
      const result = advanceTurn(loaded.state, { rules: loaded.rules });
      await repository.saveTurnResult(result, loaded.rules);

      const saved = await repository.loadGameState();
      const cell =
        saved.state.islands[0]?.cells[scenario.expected.y]?.[scenario.expected.x];

      if (
        !cell ||
        cell.terrain !== scenario.expected.terrain ||
        cell.value !== scenario.expected.value
      ) {
        throw new Error(
          `${scenario.name} failed: expected ${scenario.expected.terrain}/${scenario.expected.value}, ` +
            `got ${cell?.terrain}/${cell?.value}`
        );
      }

      process.stdout.write(`ok ${scenario.name}\n`);
    }

    process.stdout.write("db smoke completed\n");
  } finally {
    await repository.close();
  }
}
