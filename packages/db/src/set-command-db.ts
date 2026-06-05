import type { CommandPlan } from "../../core/dist/index.js";
import { isCommandKind } from "./commands.js";
import { PostgresGameRepository } from "./postgres.js";

const databaseUrl = process.env.DATABASE_URL;
const [, , islandId, positionText, kindText, xText, yText, argText] = process.argv;

if (!databaseUrl) {
  process.stderr.write("DATABASE_URL is required.\n");
  process.exitCode = 1;
} else if (!islandId || !positionText || !kindText || !xText || !yText) {
  process.stderr.write(
    "usage: pnpm run db:queue -- <islandId> <position> <kind> <x> <y> [arg]\n"
  );
  process.exitCode = 1;
} else if (!isCommandKind(kindText)) {
  process.stderr.write(`unknown command kind: ${kindText}\n`);
  process.exitCode = 1;
} else {
  const position = Number(positionText);
  const x = Number(xText);
  const y = Number(yText);
  const arg = argText === undefined ? undefined : Number(argText);

  if (!Number.isInteger(position) || position < 0) {
    process.stderr.write("position must be a non-negative integer.\n");
    process.exitCode = 1;
  } else if (!Number.isInteger(x) || !Number.isInteger(y)) {
    process.stderr.write("x and y must be integers.\n");
    process.exitCode = 1;
  } else if (argText !== undefined && !Number.isInteger(arg)) {
    process.stderr.write("arg must be an integer when provided.\n");
    process.exitCode = 1;
  } else {
    const repository = PostgresGameRepository.fromConnectionString(databaseUrl);
    const command: CommandPlan = {
      kind: kindText,
      x,
      y,
      ...(arg === undefined ? {} : { arg })
    };

    try {
      await repository.setCommand(islandId, position, command);
      process.stdout.write(
        `queued island=${islandId} position=${position} command=${kindText} x=${x} y=${y}` +
          (arg === undefined ? "\n" : ` arg=${arg}\n`)
      );
    } finally {
      await repository.close();
    }
  }
}
