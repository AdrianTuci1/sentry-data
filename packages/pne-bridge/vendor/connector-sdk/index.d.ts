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
export declare class ConnectorRegistry {
    private readonly connectors;
    register(connectorId: string, connector: WarehouseConnector): void;
    get(connectorId: string): WarehouseConnector;
    list(): Array<{
        connectorId: string;
        engine: WarehouseEngine;
    }>;
}
export declare class SqlFunctionConnector implements WarehouseConnector {
    private readonly config;
    readonly engine: WarehouseEngine;
    private readonly tables;
    constructor(config: SqlFunctionConnectorConfig);
    introspect(): Promise<WarehouseTableProfile[]>;
    sample(tableId: string, limit?: number): Promise<Record<string, unknown>[]>;
    dryRun(request: WarehouseQueryRequest): Promise<WarehouseCostEstimate>;
    execute(request: WarehouseQueryRequest): Promise<WarehouseQueryResult>;
}
export declare class BigQueryConnector implements WarehouseConnector {
    private readonly config;
    readonly engine: WarehouseEngine;
    constructor(config: BigQueryConnectorConfig);
    introspect(): Promise<WarehouseTableProfile[]>;
    sample(tableId: string, limit?: number): Promise<Record<string, unknown>[]>;
    dryRun(request: WarehouseQueryRequest): Promise<WarehouseCostEstimate>;
    execute(request: WarehouseQueryRequest): Promise<WarehouseQueryResult>;
    private extractRows;
    private describeTable;
}
export declare class SnowflakeConnector implements WarehouseConnector {
    private readonly config;
    readonly engine: WarehouseEngine;
    constructor(config: SnowflakeConnectorConfig);
    introspect(): Promise<WarehouseTableProfile[]>;
    sample(tableId: string, limit?: number): Promise<Record<string, unknown>[]>;
    dryRun(request: WarehouseQueryRequest): Promise<WarehouseCostEstimate>;
    execute(request: WarehouseQueryRequest): Promise<WarehouseQueryResult>;
    private listTableNames;
    private describeTable;
    private runSql;
}
export declare class DuckDbConnector implements WarehouseConnector {
    private readonly config;
    readonly engine: WarehouseEngine;
    private readonly virtualTables;
    constructor(config: DuckDbConnectorConfig);
    introspect(): Promise<WarehouseTableProfile[]>;
    sample(tableId: string, limit?: number): Promise<Record<string, unknown>[]>;
    dryRun(request: WarehouseQueryRequest): Promise<WarehouseCostEstimate>;
    execute(request: WarehouseQueryRequest): Promise<WarehouseQueryResult>;
    private listTableNames;
    private describeTable;
    private runSql;
}
export declare class PostgresConnector implements WarehouseConnector {
    private readonly config;
    readonly engine: WarehouseEngine;
    constructor(config: PostgresConnectorConfig);
    introspect(): Promise<WarehouseTableProfile[]>;
    sample(tableId: string, limit?: number): Promise<Record<string, unknown>[]>;
    dryRun(request: WarehouseQueryRequest): Promise<WarehouseCostEstimate>;
    execute(request: WarehouseQueryRequest): Promise<WarehouseQueryResult>;
    private listTableNames;
    private describeTable;
    private runSql;
}
export declare const createSqlFunctionConnector: (config: SqlFunctionConnectorConfig) => SqlFunctionConnector;
export declare const createBigQueryConnector: (config: BigQueryConnectorConfig) => BigQueryConnector;
export declare const createSnowflakeConnector: (config: SnowflakeConnectorConfig) => SnowflakeConnector;
export declare const createDuckDbConnector: (config: DuckDbConnectorConfig) => DuckDbConnector;
export declare const createPostgresConnector: (config: PostgresConnectorConfig) => PostgresConnector;
