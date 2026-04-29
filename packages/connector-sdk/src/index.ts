declare const require: any;
declare const process: {
  env: Record<string, string | undefined>;
};

const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

export type WarehouseEngine = 'bigquery' | 'snowflake' | 'duckdb' | 'postgres' | 'custom';

export interface WarehouseColumn {
  name: string;
  type: string;
  nullable?: boolean;
  semanticType?: 'id' | 'timestamp' | 'metric' | 'dimension' | 'json' | 'unknown';
}

export interface WarehouseTableProfile {
  tableId: string;
  displayName?: string;
  engine: WarehouseEngine;
  columns: WarehouseColumn[];
  rowCount?: number;
  sizeBytes?: number;
  freshnessColumn?: string;
  metricCandidates?: string[];
  entityKeyCandidates?: string[];
  timestampCandidates?: string[];
  sampleRows?: Record<string, unknown>[];
  metadata?: Record<string, unknown>;
}

export interface WarehouseQueryRequest {
  requestId: string;
  sql: string;
  maxRows?: number;
  dryRun?: boolean;
  timeoutMs?: number;
  labels?: Record<string, string>;
}

export interface WarehouseQueryResult {
  requestId: string;
  rows: Record<string, unknown>[];
  rowCount: number;
  elapsedMs?: number;
  bytesProcessed?: number;
  cacheHit?: boolean;
  error?: {
    code: string;
    message: string;
    retryable?: boolean;
  };
}

export interface WarehouseCostEstimate {
  bytesProcessed?: number;
  estimatedCostUsd?: number;
  warnings?: string[];
}

export interface WarehouseConnector {
  readonly engine: WarehouseEngine;
  introspect(): Promise<WarehouseTableProfile[]>;
  sample(tableId: string, limit?: number): Promise<Record<string, unknown>[]>;
  dryRun(request: WarehouseQueryRequest): Promise<WarehouseCostEstimate>;
  execute(request: WarehouseQueryRequest): Promise<WarehouseQueryResult>;
}

export interface WarehouseConnectorFactory<TConfig = Record<string, unknown>> {
  readonly engine: WarehouseEngine;
  create(config: TConfig): WarehouseConnector;
}

export interface BigQueryConnectorConfig {
  projectId: string;
  datasetId?: string;
  location?: string;
  credentials?: unknown;
  command?: string;
  client?: {
    query(options: {
      query: string;
      location?: string;
      dryRun?: boolean;
      maximumBytesBilled?: string | number;
      labels?: Record<string, string>;
    }): Promise<unknown>;
    getDatasets?(): Promise<unknown>;
  };
}

export interface SnowflakeConnectorConfig {
  connectionName?: string;
  database: string;
  schema: string;
  warehouse?: string;
  role?: string;
  command?: string;
  tables?: string[];
}

export interface DuckDbConnectorConfig {
  databasePath: string;
  command?: string;
  tables?: string[];
  bootstrapSql?: string[];
  virtualTables?: Array<{
    tableId: string;
    sql: string;
    displayName?: string;
    metadata?: Record<string, unknown>;
  }>;
}

export interface PostgresConnectorConfig {
  connectionString: string;
  schema?: string;
  command?: string;
  tables?: string[];
}

export interface SqlFunctionConnectorConfig {
  engine: WarehouseEngine;
  tables?: WarehouseTableProfile[];
  executeSql: (request: WarehouseQueryRequest) => Promise<WarehouseQueryResult>;
  dryRunSql?: (request: WarehouseQueryRequest) => Promise<WarehouseCostEstimate>;
  sampleTable?: (tableId: string, limit: number) => Promise<Record<string, unknown>[]>;
}

export class ConnectorRegistry {
  private readonly connectors = new Map<string, WarehouseConnector>();

  public register(connectorId: string, connector: WarehouseConnector): void {
    this.connectors.set(connectorId, connector);
  }

  public get(connectorId: string): WarehouseConnector {
    const connector = this.connectors.get(connectorId);
    if (!connector) {
      throw new Error(`Warehouse connector not registered: ${connectorId}`);
    }

    return connector;
  }

  public list(): Array<{ connectorId: string; engine: WarehouseEngine }> {
    return [...this.connectors.entries()].map(([connectorId, connector]) => ({
      connectorId,
      engine: connector.engine
    }));
  }
}

export class SqlFunctionConnector implements WarehouseConnector {
  public readonly engine: WarehouseEngine;
  private readonly tables: WarehouseTableProfile[];

  constructor(private readonly config: SqlFunctionConnectorConfig) {
    this.engine = config.engine;
    this.tables = config.tables || [];
  }

  public async introspect(): Promise<WarehouseTableProfile[]> {
    return this.tables;
  }

  public async sample(tableId: string, limit: number = 20): Promise<Record<string, unknown>[]> {
    if (this.config.sampleTable) {
      return this.config.sampleTable(tableId, limit);
    }

    const result = await this.execute({
      requestId: `sample-${Date.now()}`,
      sql: `SELECT * FROM ${tableId} LIMIT ${limit}`,
      maxRows: limit
    });

    return result.rows;
  }

  public async dryRun(request: WarehouseQueryRequest): Promise<WarehouseCostEstimate> {
    if (this.config.dryRunSql) {
      return this.config.dryRunSql(request);
    }

    return {
      warnings: ['dry_run_not_supported_by_connector']
    };
  }

  public async execute(request: WarehouseQueryRequest): Promise<WarehouseQueryResult> {
    const startedAt = Date.now();
    try {
      const result = await this.config.executeSql(request);
      return {
        ...result,
        requestId: result.requestId || request.requestId,
        rowCount: result.rowCount ?? result.rows.length,
        elapsedMs: result.elapsedMs ?? Date.now() - startedAt
      };
    } catch (error) {
      return {
        requestId: request.requestId,
        rows: [],
        rowCount: 0,
        elapsedMs: Date.now() - startedAt,
        error: {
          code: 'connector_execute_failed',
          message: error instanceof Error ? error.message : String(error),
          retryable: false
        }
      };
    }
  }
}

export class BigQueryConnector implements WarehouseConnector {
  public readonly engine: WarehouseEngine = 'bigquery';

  constructor(private readonly config: BigQueryConnectorConfig) {}

  public async introspect(): Promise<WarehouseTableProfile[]> {
    if (this.config.client?.getDatasets) {
      await this.config.client.getDatasets();
      return [];
    }

    const command = this.config.command || 'bq';
    const datasetTarget = this.config.datasetId
      ? `${this.config.projectId}:${this.config.datasetId}`
      : this.config.projectId;
    const { stdout } = await execFileAsync(command, [
      'ls',
      '--format=prettyjson',
      datasetTarget
    ]);
    const tables = JSON.parse(stdout || '[]');
    const profiles = await Promise.all((Array.isArray(tables) ? tables : []).map(async (table: any) => {
      const datasetId = table.tableReference?.datasetId || this.config.datasetId;
      const tableId = table.tableReference?.tableId;
      const fullTableId = `${this.config.projectId}.${datasetId}.${tableId}`;
      return this.describeTable(fullTableId);
    }));
    return profiles.filter(Boolean) as WarehouseTableProfile[];
  }

  public async sample(tableId: string, limit: number = 20): Promise<Record<string, unknown>[]> {
    const result = await this.execute({
      requestId: `sample-${Date.now()}`,
      sql: `SELECT * FROM \`${tableId}\` LIMIT ${limit}`,
      maxRows: limit
    });

    return result.rows;
  }

  public async dryRun(request: WarehouseQueryRequest): Promise<WarehouseCostEstimate> {
    if (!this.config.client) {
      const command = this.config.command || 'bq';
      try {
        await execFileAsync(command, [
          'query',
          '--use_legacy_sql=false',
          '--dry_run=true',
          '--format=prettyjson',
          request.sql
        ]);
        return {};
      } catch (error) {
        return {
          warnings: [error instanceof Error ? error.message : String(error)]
        };
      }
    }

    try {
      await this.config.client.query({
        query: request.sql,
        location: this.config.location,
        dryRun: true,
        labels: request.labels
      });

      return {};
    } catch (error) {
      return {
        warnings: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  public async execute(request: WarehouseQueryRequest): Promise<WarehouseQueryResult> {
    const startedAt = Date.now();
    if (!this.config.client) {
      try {
        const command = this.config.command || 'bq';
        const { stdout } = await execFileAsync(command, [
          'query',
          '--use_legacy_sql=false',
          '--format=prettyjson',
          request.sql
        ], {
          maxBuffer: 10 * 1024 * 1024
        });
        const rows = this.extractRows(JSON.parse(stdout || '[]')).slice(0, request.maxRows || Number.MAX_SAFE_INTEGER);
        return {
          requestId: request.requestId,
          rows,
          rowCount: rows.length,
          elapsedMs: Date.now() - startedAt
        };
      } catch (error) {
        return {
          requestId: request.requestId,
          rows: [],
          rowCount: 0,
          elapsedMs: Date.now() - startedAt,
          error: {
            code: 'bigquery_execute_failed',
            message: error instanceof Error ? error.message : String(error),
            retryable: false
          }
        };
      }
    }

    try {
      const response = await this.config.client.query({
        query: request.sql,
        location: this.config.location,
        labels: request.labels
      });
      const rows = this.extractRows(response).slice(0, request.maxRows || Number.MAX_SAFE_INTEGER);

      return {
        requestId: request.requestId,
        rows,
        rowCount: rows.length,
        elapsedMs: Date.now() - startedAt
      };
    } catch (error) {
      return {
        requestId: request.requestId,
        rows: [],
        rowCount: 0,
        elapsedMs: Date.now() - startedAt,
        error: {
          code: 'bigquery_execute_failed',
          message: error instanceof Error ? error.message : String(error),
          retryable: false
        }
      };
    }
  }

  private extractRows(response: unknown): Record<string, unknown>[] {
    if (Array.isArray(response) && Array.isArray(response[0])) {
      return response[0] as Record<string, unknown>[];
    }

    if (Array.isArray(response)) {
      return response as Record<string, unknown>[];
    }

    return [];
  }

  private async describeTable(fullTableId: string): Promise<WarehouseTableProfile | null> {
    const command = this.config.command || 'bq';
    try {
      const { stdout } = await execFileAsync(command, [
        'show',
        '--schema',
        '--format=prettyjson',
        fullTableId
      ]);
      const schema = JSON.parse(stdout || '[]');
      const columns = (Array.isArray(schema) ? schema : []).map((field: any) => ({
        name: String(field.name),
        type: String(field.type || 'STRING'),
        nullable: String(field.mode || 'NULLABLE').toUpperCase() !== 'REQUIRED',
        semanticType: inferSemanticType(String(field.name), String(field.type || 'STRING'))
      }));
      return buildWarehouseTableProfile({
        tableId: fullTableId,
        displayName: fullTableId.split('.').pop(),
        engine: 'bigquery',
        columns
      });
    } catch {
      return null;
    }
  }
}

export class SnowflakeConnector implements WarehouseConnector {
  public readonly engine: WarehouseEngine = 'snowflake';

  constructor(private readonly config: SnowflakeConnectorConfig) {}

  public async introspect(): Promise<WarehouseTableProfile[]> {
    const tables = this.config.tables?.length
      ? this.config.tables
      : await this.listTableNames();
    const profiles = await Promise.all(tables.map((tableId) => this.describeTable(tableId)));
    return profiles.filter(Boolean) as WarehouseTableProfile[];
  }

  public async sample(tableId: string, limit: number = 20): Promise<Record<string, unknown>[]> {
    const result = await this.execute({
      requestId: `sample-${Date.now()}`,
      sql: `SELECT * FROM ${tableId} LIMIT ${limit}`,
      maxRows: limit
    });
    return result.rows;
  }

  public async dryRun(request: WarehouseQueryRequest): Promise<WarehouseCostEstimate> {
    try {
      await this.runSql(`EXPLAIN USING TEXT ${request.sql}`);
      return {};
    } catch (error) {
      return {
        warnings: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  public async execute(request: WarehouseQueryRequest): Promise<WarehouseQueryResult> {
    const startedAt = Date.now();
    try {
      const rows = await this.runSql(request.sql);
      return {
        requestId: request.requestId,
        rows: rows.slice(0, request.maxRows || Number.MAX_SAFE_INTEGER),
        rowCount: rows.length,
        elapsedMs: Date.now() - startedAt
      };
    } catch (error) {
      return {
        requestId: request.requestId,
        rows: [],
        rowCount: 0,
        elapsedMs: Date.now() - startedAt,
        error: {
          code: 'snowflake_execute_failed',
          message: error instanceof Error ? error.message : String(error),
          retryable: false
        }
      };
    }
  }

  private async listTableNames(): Promise<string[]> {
    const rows = await this.runSql(
      `SELECT TABLE_SCHEMA || '.' || TABLE_NAME AS table_id
       FROM ${this.config.database}.INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = '${this.config.schema}'
         AND TABLE_TYPE = 'BASE TABLE'
       ORDER BY TABLE_NAME`
    );
    return rows.map((row) => String(row.table_id));
  }

  private async describeTable(tableId: string): Promise<WarehouseTableProfile | null> {
    const [schema, table] = tableId.includes('.') ? tableId.split('.', 2) : [this.config.schema, tableId];
    try {
      const rows = await this.runSql(
        `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
         FROM ${this.config.database}.INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = '${schema}'
           AND TABLE_NAME = '${table}'
         ORDER BY ORDINAL_POSITION`
      );
      const columns = rows.map((row) => ({
        name: String(row.COLUMN_NAME ?? row.column_name),
        type: String(row.DATA_TYPE ?? row.data_type ?? 'TEXT'),
        nullable: String(row.IS_NULLABLE ?? row.is_nullable ?? 'YES').toUpperCase() !== 'NO',
        semanticType: inferSemanticType(
          String(row.COLUMN_NAME ?? row.column_name),
          String(row.DATA_TYPE ?? row.data_type ?? 'TEXT')
        )
      }));
      return buildWarehouseTableProfile({
        tableId: `${schema}.${table}`,
        displayName: table,
        engine: 'snowflake',
        columns
      });
    } catch {
      return null;
    }
  }

  private async runSql(sql: string): Promise<Record<string, unknown>[]> {
    const command = this.config.command || 'snowsql';
    const args = [
      ...(this.config.connectionName ? ['-c', this.config.connectionName] : []),
      ...(this.config.database ? ['-d', this.config.database] : []),
      ...(this.config.schema ? ['-s', this.config.schema] : []),
      ...(this.config.warehouse ? ['-w', this.config.warehouse] : []),
      ...(this.config.role ? ['-r', this.config.role] : []),
      '-o', 'output_format=csv',
      '-o', 'header=true',
      '-q', sql
    ];
    const { stdout } = await execFileAsync(command, args, {
      env: process.env,
      maxBuffer: 10 * 1024 * 1024
    });
    return parseCsv(stdout || '');
  }
}

export class DuckDbConnector implements WarehouseConnector {
  public readonly engine: WarehouseEngine = 'duckdb';
  private readonly virtualTables: Array<{
    tableId: string;
    sql: string;
    displayName?: string;
    metadata?: Record<string, unknown>;
  }>;

  constructor(private readonly config: DuckDbConnectorConfig) {
    this.virtualTables = config.virtualTables || [];
  }

  public async introspect(): Promise<WarehouseTableProfile[]> {
    const tables = this.config.tables?.length
      ? this.config.tables
      : await this.listTableNames();
    const profiles = await Promise.all(tables.map((tableId) => this.describeTable(tableId)));
    return profiles.filter(Boolean) as WarehouseTableProfile[];
  }

  public async sample(tableId: string, limit: number = 20): Promise<Record<string, unknown>[]> {
    const result = await this.execute({
      requestId: `sample-${Date.now()}`,
      sql: `SELECT * FROM ${tableId} LIMIT ${limit}`,
      maxRows: limit
    });
    return result.rows;
  }

  public async dryRun(request: WarehouseQueryRequest): Promise<WarehouseCostEstimate> {
    try {
      await this.runSql(`EXPLAIN ${request.sql}`);
      return {};
    } catch (error) {
      return {
        warnings: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  public async execute(request: WarehouseQueryRequest): Promise<WarehouseQueryResult> {
    const startedAt = Date.now();
    try {
      const rows = await this.runSql(request.sql);
      return {
        requestId: request.requestId,
        rows: rows.slice(0, request.maxRows || Number.MAX_SAFE_INTEGER),
        rowCount: rows.length,
        elapsedMs: Date.now() - startedAt
      };
    } catch (error) {
      return {
        requestId: request.requestId,
        rows: [],
        rowCount: 0,
        elapsedMs: Date.now() - startedAt,
        error: {
          code: 'duckdb_execute_failed',
          message: error instanceof Error ? error.message : String(error),
          retryable: false
        }
      };
    }
  }

  private async listTableNames(): Promise<string[]> {
    if (this.virtualTables.length > 0) {
      return this.virtualTables.map((table) => table.tableId);
    }
    const rows = await this.runSql('SELECT table_name FROM information_schema.tables WHERE table_schema NOT IN (\'information_schema\', \'pg_catalog\') ORDER BY table_name');
    return rows.map((row) => String(row.table_name));
  }

  private async describeTable(tableId: string): Promise<WarehouseTableProfile | null> {
    try {
      const virtualTable = this.virtualTables.find((table) => table.tableId === tableId);
      const rows = await this.runSql(
        virtualTable
          ? `DESCRIBE SELECT * FROM (${virtualTable.sql}) AS ${quoteIdentifier(tableId)}`
          : `DESCRIBE SELECT * FROM ${tableId}`
      );
      const columns = rows.map((row) => ({
        name: String(row.column_name || row.name),
        type: String(row.column_type || row.type || 'VARCHAR'),
        nullable: String(row.null || row.nullable || 'YES').toUpperCase() !== 'NO',
        semanticType: inferSemanticType(
          String(row.column_name || row.name),
          String(row.column_type || row.type || 'VARCHAR')
        )
      }));
      return buildWarehouseTableProfile({
        tableId,
        displayName: virtualTable?.displayName || tableId,
        engine: 'duckdb',
        columns,
        metadata: virtualTable?.metadata
      });
    } catch {
      return null;
    }
  }

  private async runSql(sql: string): Promise<Record<string, unknown>[]> {
    const command = this.config.command || 'duckdb';
    const preludeStatements = [
      ...(this.config.bootstrapSql || []),
      ...this.virtualTables.map((table) => `CREATE OR REPLACE VIEW ${quoteIdentifier(table.tableId)} AS ${table.sql}`)
    ];
    const composedSql = [...preludeStatements, sql].join(';\n');
    const { stdout } = await execFileAsync(command, [
      this.config.databasePath,
      '-json',
      composedSql
    ], {
      maxBuffer: 10 * 1024 * 1024
    });
    const parsed = JSON.parse(stdout || '[]');
    return Array.isArray(parsed) ? parsed as Record<string, unknown>[] : [];
  }
}

export class PostgresConnector implements WarehouseConnector {
  public readonly engine: WarehouseEngine = 'postgres';

  constructor(private readonly config: PostgresConnectorConfig) {}

  public async introspect(): Promise<WarehouseTableProfile[]> {
    const tables = this.config.tables?.length
      ? this.config.tables
      : await this.listTableNames();
    const profiles = await Promise.all(tables.map((tableId) => this.describeTable(tableId)));
    return profiles.filter(Boolean) as WarehouseTableProfile[];
  }

  public async sample(tableId: string, limit: number = 20): Promise<Record<string, unknown>[]> {
    const result = await this.execute({
      requestId: `sample-${Date.now()}`,
      sql: `SELECT * FROM ${tableId} LIMIT ${limit}`,
      maxRows: limit
    });
    return result.rows;
  }

  public async dryRun(request: WarehouseQueryRequest): Promise<WarehouseCostEstimate> {
    try {
      await this.runSql(`EXPLAIN ${request.sql}`);
      return {};
    } catch (error) {
      return {
        warnings: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  public async execute(request: WarehouseQueryRequest): Promise<WarehouseQueryResult> {
    const startedAt = Date.now();
    try {
      const rows = await this.runSql(request.sql);
      return {
        requestId: request.requestId,
        rows: rows.slice(0, request.maxRows || Number.MAX_SAFE_INTEGER),
        rowCount: rows.length,
        elapsedMs: Date.now() - startedAt
      };
    } catch (error) {
      return {
        requestId: request.requestId,
        rows: [],
        rowCount: 0,
        elapsedMs: Date.now() - startedAt,
        error: {
          code: 'postgres_execute_failed',
          message: error instanceof Error ? error.message : String(error),
          retryable: false
        }
      };
    }
  }

  private async listTableNames(): Promise<string[]> {
    const schema = this.config.schema || 'public';
    const rows = await this.runSql(
      `SELECT table_schema || '.' || table_name AS table_id FROM information_schema.tables WHERE table_schema = '${schema}' AND table_type = 'BASE TABLE' ORDER BY table_name`
    );
    return rows.map((row) => String(row.table_id));
  }

  private async describeTable(tableId: string): Promise<WarehouseTableProfile | null> {
    const [schema, table] = tableId.includes('.') ? tableId.split('.', 2) : [this.config.schema || 'public', tableId];
    try {
      const rows = await this.runSql(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_schema = '${schema}' AND table_name = '${table}'
         ORDER BY ordinal_position`
      );
      const columns = rows.map((row) => ({
        name: String(row.column_name),
        type: String(row.data_type || 'text'),
        nullable: String(row.is_nullable || 'YES').toUpperCase() !== 'NO',
        semanticType: inferSemanticType(String(row.column_name), String(row.data_type || 'text'))
      }));
      return buildWarehouseTableProfile({
        tableId,
        displayName: table,
        engine: 'postgres',
        columns
      });
    } catch {
      return null;
    }
  }

  private async runSql(sql: string): Promise<Record<string, unknown>[]> {
    const command = this.config.command || 'psql';
    const { stdout } = await execFileAsync(command, [
      this.config.connectionString,
      '-X',
      '-A',
      '--csv',
      '-c',
      sql
    ], {
      env: process.env,
      maxBuffer: 10 * 1024 * 1024
    });
    return parseCsv(stdout || '');
  }
}

export const createSqlFunctionConnector = (config: SqlFunctionConnectorConfig) => (
  new SqlFunctionConnector(config)
);

export const createBigQueryConnector = (config: BigQueryConnectorConfig) => (
  new BigQueryConnector(config)
);

export const createSnowflakeConnector = (config: SnowflakeConnectorConfig) => (
  new SnowflakeConnector(config)
);

export const createDuckDbConnector = (config: DuckDbConnectorConfig) => (
  new DuckDbConnector(config)
);

export const createPostgresConnector = (config: PostgresConnectorConfig) => (
  new PostgresConnector(config)
);

const inferSemanticType = (
  columnName: string,
  columnType: string
): WarehouseColumn['semanticType'] => {
  const normalizedName = columnName.toLowerCase();
  const normalizedType = columnType.toLowerCase();

  if (normalizedName.endsWith('_id') || normalizedName === 'id') {
    return 'id';
  }
  if (normalizedName.includes('date') || normalizedName.includes('time') || normalizedType.includes('timestamp')) {
    return 'timestamp';
  }
  if (normalizedType.includes('int') || normalizedType.includes('decimal') || normalizedType.includes('numeric') || normalizedType.includes('double') || normalizedType.includes('float')) {
    return 'metric';
  }
  if (normalizedType.includes('json')) {
    return 'json';
  }
  if (normalizedType.includes('char') || normalizedType.includes('text') || normalizedType.includes('string')) {
    return 'dimension';
  }
  return 'unknown';
};

const buildWarehouseTableProfile = (
  input: Pick<WarehouseTableProfile, 'tableId' | 'displayName' | 'engine' | 'columns'>
  & Pick<WarehouseTableProfile, 'metadata'>
): WarehouseTableProfile => {
  const metricCandidates = input.columns
    .filter((column) => column.semanticType === 'metric')
    .map((column) => column.name);
  const entityKeyCandidates = input.columns
    .filter((column) => column.semanticType === 'id')
    .map((column) => column.name);
  const timestampCandidates = input.columns
    .filter((column) => column.semanticType === 'timestamp')
    .map((column) => column.name);

  return {
    ...input,
    metricCandidates,
    entityKeyCandidates,
    timestampCandidates,
    freshnessColumn: timestampCandidates[0]
  };
};

const parseCsv = (text: string): Record<string, unknown>[] => {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }
  const lines = trimmed.split(/\r?\n/);
  if (lines.length < 2) {
    return [];
  }
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).filter(Boolean).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce<Record<string, unknown>>((accumulator, header, index) => {
      accumulator[header] = values[index] ?? null;
      return accumulator;
    }, {});
  });
};

const parseCsvLine = (line: string): string[] => {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
};

const quoteIdentifier = (value: string): string => (
  `"${String(value).replace(/"/g, '""')}"`
);
