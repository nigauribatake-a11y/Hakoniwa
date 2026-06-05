import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { PostgresGameRepository } from "../../db/dist/index.js";
import { handleApiRequest } from "./router.js";

const databaseUrl = process.env.DATABASE_URL;
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";

if (!databaseUrl) {
  process.stderr.write("DATABASE_URL is required.\n");
  process.exitCode = 1;
} else {
  const repository = PostgresGameRepository.fromConnectionString(databaseUrl);
  const server = createServer((request, response) => {
    void handleHttpRequest(request, response, repository);
  });

  server.listen(port, host, () => {
    process.stdout.write(`hakoniwa api listening on http://${host}:${port}\n`);
  });
}

async function handleHttpRequest(
  request: IncomingMessage,
  response: ServerResponse,
  repository: PostgresGameRepository
): Promise<void> {
  const body = await readJsonBody(request);
  const url = new URL(request.url ?? "/", "http://localhost");
  const result = await handleApiRequest(
    {
      method: request.method ?? "GET",
      path: url.pathname,
      body
    },
    repository
  );

  response.statusCode = result.status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("access-control-allow-origin", "*");
  response.end(JSON.stringify(result.body));
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  if (request.method === "GET" || request.method === "HEAD") return undefined;

  const chunks: Uint8Array[] = [];
  await new Promise<void>((resolve, reject) => {
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", resolve);
    request.on("error", reject);
  });

  if (chunks.length === 0) return undefined;
  const text = Buffer.concat(chunks).toString("utf8");
  if (text.trim().length === 0) return undefined;
  return JSON.parse(text);
}
