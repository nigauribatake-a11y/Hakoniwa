declare const process: {
  env: Record<string, string | undefined>;
  cwd(): string;
  stdout: {
    write(text: string): void;
  };
};

declare const Buffer: {
  from(input: string): Uint8Array;
};

declare module "node:http" {
  export interface IncomingMessage {
    url?: string;
    method?: string;
  }

  export interface ServerResponse {
    statusCode: number;
    setHeader(name: string, value: string): void;
    end(body?: string | Uint8Array): void;
  }

  export interface Server {
    listen(port: number, host: string, callback?: () => void): void;
  }

  export function createServer(
    handler: (request: IncomingMessage, response: ServerResponse) => void
  ): Server;
}

declare module "node:fs/promises" {
  export function readFile(path: string | URL): Promise<Uint8Array>;
}

declare module "node:path" {
  export function extname(path: string): string;
  export function join(...paths: string[]): string;
  export function normalize(path: string): string;
  export const sep: string;
}

declare module "node:url" {
  export function fileURLToPath(url: string | URL): string;
}

declare module "node:assert/strict" {
  interface Assert {
    equal(actual: unknown, expected: unknown, message?: string): void;
  }

  const assert: Assert;
  export default assert;
}

declare module "node:test" {
  export function test(name: string, fn: () => void | Promise<void>): void;
}
