import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const port = Number(process.env.WEB_PORT ?? 5173);
const host = process.env.WEB_HOST ?? "127.0.0.1";
const webRoot = fileURLToPath(new URL("..", import.meta.url));
const publicRoot = join(webRoot, "public");
const distRoot = join(webRoot, "dist");

const mimeTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};

createServer((request, response) => {
  void serve(request.url ?? "/", response);
}).listen(port, host, () => {
  process.stdout.write(`hakoniwa web listening on http://${host}:${port}\n`);
});

async function serve(rawUrl: string, response: {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string | Uint8Array): void;
}): Promise<void> {
  const url = new URL(rawUrl, "http://localhost");
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const root = pathname === "/app.js" ? distRoot : publicRoot;
  const relativePath = pathname === "/app.js" ? "app.js" : pathname.slice(1);
  const filePath = normalize(join(root, relativePath));

  if (!filePath.startsWith(normalize(root) + sep) && filePath !== normalize(root)) {
    response.statusCode = 403;
    response.end("forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    response.statusCode = 200;
    response.setHeader("content-type", mimeTypes[extname(filePath)] ?? "application/octet-stream");
    response.end(body);
  } catch {
    response.statusCode = 404;
    response.setHeader("content-type", "text/plain; charset=utf-8");
    response.end("not found");
  }
}
