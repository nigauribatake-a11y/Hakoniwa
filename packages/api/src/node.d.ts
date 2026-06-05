declare module "node:assert/strict" {
  interface Assert {
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
    equal(actual: unknown, expected: unknown, message?: string): void;
  }

  const assert: Assert;
  export default assert;
}

declare module "node:http" {
  export interface IncomingMessage {
    method?: string;
    url?: string;
    on(event: "data", listener: (chunk: Uint8Array) => void): void;
    on(event: "end", listener: () => void): void;
    on(event: "error", listener: (error: Error) => void): void;
  }

  export interface ServerResponse {
    statusCode: number;
    setHeader(name: string, value: string): void;
    end(body?: string): void;
  }

  export interface Server {
    listen(port: number, host: string, callback?: () => void): void;
  }

  export function createServer(
    listener: (request: IncomingMessage, response: ServerResponse) => void
  ): Server;
}

declare module "node:test" {
  export function test(name: string, fn: () => void | Promise<void>): void;
}

declare module "pg" {
  export interface QueryResult<Row = Record<string, unknown>> {
    rows: Row[];
    rowCount: number | null;
  }

  export interface PoolClient {
    query<Row = Record<string, unknown>>(
      sql: string,
      values?: unknown[]
    ): Promise<QueryResult<Row>>;
    release(): void;
  }

  export interface PoolConfig {
    connectionString?: string;
  }

  export class Pool {
    constructor(config?: PoolConfig);
    query<Row = Record<string, unknown>>(
      sql: string,
      values?: unknown[]
    ): Promise<QueryResult<Row>>;
    connect(): Promise<PoolClient>;
    end(): Promise<void>;
  }

  const pg: {
    Pool: typeof Pool;
  };

  export default pg;
}

declare const Buffer: {
  concat(chunks: Uint8Array[]): {
    toString(encoding: "utf8"): string;
  };
};

declare const process: {
  env: Record<string, string | undefined>;
  exitCode?: number;
  stdout: {
    write(text: string): void;
  };
  stderr: {
    write(text: string): void;
  };
};
