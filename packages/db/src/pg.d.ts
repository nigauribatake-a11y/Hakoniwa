declare module "pg" {
  export interface QueryResult<Row = Record<string, unknown>> {
    rows: Row[];
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
