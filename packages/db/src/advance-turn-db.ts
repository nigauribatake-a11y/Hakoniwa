import { advanceTurn } from "../../core/dist/index.js";
import { PostgresGameRepository } from "./postgres.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  process.stderr.write("DATABASE_URL is required.\n");
  process.exitCode = 1;
} else {
  const repository = PostgresGameRepository.fromConnectionString(databaseUrl);

  try {
    const loaded = await repository.loadGameState();
    const result = advanceTurn(loaded.state, { rules: loaded.rules });
    await repository.saveTurnResult(result, loaded.rules);
    process.stdout.write(
      `advanced turn ${loaded.state.turn} -> ${result.state.turn}; logs=${result.logs.length}\n`
    );
  } finally {
    await repository.close();
  }
}
