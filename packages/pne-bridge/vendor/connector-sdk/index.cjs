"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPostgresConnector = exports.createDuckDbConnector = exports.createSnowflakeConnector = exports.createBigQueryConnector = exports.createSqlFunctionConnector = exports.PostgresConnector = exports.DuckDbConnector = exports.SnowflakeConnector = exports.BigQueryConnector = exports.SqlFunctionConnector = exports.ConnectorRegistry = void 0;
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
class ConnectorRegistry {
    constructor() {
        this.connectors = new Map();
    }
    register(connectorId, connector) {
        this.connectors.set(connectorId, connector);
    }
    get(connectorId) {
        const connector = this.connectors.get(connectorId);
        if (!connector) {
            throw new Error(`Warehouse connector not registered: ${connectorId}`);
        }
        return connector;
    }
    list() {
        return [...this.connectors.entries()].map(([connectorId, connector]) => ({
            connectorId,
            engine: connector.engine
        }));
    }
}
exports.ConnectorRegistry = ConnectorRegistry;
class SqlFunctionConnector {
    constructor(config) {
        this.config = config;
        this.engine = config.engine;
        this.tables = config.tables || [];
    }
    async introspect() {
        return this.tables;
    }
    async sample(tableId, limit = 20) {
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
    async dryRun(request) {
        if (this.config.dryRunSql) {
            return this.config.dryRunSql(request);
        }
        return {
            warnings: ['dry_run_not_supported_by_connector']
        };
    }
    async execute(request) {
        const startedAt = Date.now();
        try {
            const result = await this.config.executeSql(request);
            return {
                ...result,
                requestId: result.requestId || request.requestId,
                rowCount: result.rowCount ?? result.rows.length,
                elapsedMs: result.elapsedMs ?? Date.now() - startedAt
            };
        }
        catch (error) {
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
exports.SqlFunctionConnector = SqlFunctionConnector;
class BigQueryConnector {
    constructor(config) {
        this.config = config;
        this.engine = 'bigquery';
    }
    async introspect() {
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
        const profiles = await Promise.all((Array.isArray(tables) ? tables : []).map(async (table) => {
            const datasetId = table.tableReference?.datasetId || this.config.datasetId;
            const tableId = table.tableReference?.tableId;
            const fullTableId = `${this.config.projectId}.${datasetId}.${tableId}`;
            return this.describeTable(fullTableId);
        }));
        return profiles.filter(Boolean);
    }
    async sample(tableId, limit = 20) {
        const result = await this.execute({
            requestId: `sample-${Date.now()}`,
            sql: `SELECT * FROM \`${tableId}\` LIMIT ${limit}`,
            maxRows: limit
        });
        return result.rows;
    }
    async dryRun(request) {
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
            }
            catch (error) {
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
        }
        catch (error) {
            return {
                warnings: [error instanceof Error ? error.message : String(error)]
            };
        }
    }
    async execute(request) {
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
            }
            catch (error) {
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
        }
        catch (error) {
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
    extractRows(response) {
        if (Array.isArray(response) && Array.isArray(response[0])) {
            return response[0];
        }
        if (Array.isArray(response)) {
            return response;
        }
        return [];
    }
    async describeTable(fullTableId) {
        const command = this.config.command || 'bq';
        try {
            const { stdout } = await execFileAsync(command, [
                'show',
                '--schema',
                '--format=prettyjson',
                fullTableId
            ]);
            const schema = JSON.parse(stdout || '[]');
            const columns = (Array.isArray(schema) ? schema : []).map((field) => ({
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
        }
        catch {
            return null;
        }
    }
}
exports.BigQueryConnector = BigQueryConnector;
class SnowflakeConnector {
    constructor(config) {
        this.config = config;
        this.engine = 'snowflake';
    }
    async introspect() {
        const tables = this.config.tables?.length
            ? this.config.tables
            : await this.listTableNames();
        const profiles = await Promise.all(tables.map((tableId) => this.describeTable(tableId)));
        return profiles.filter(Boolean);
    }
    async sample(tableId, limit = 20) {
        const result = await this.execute({
            requestId: `sample-${Date.now()}`,
            sql: `SELECT * FROM ${tableId} LIMIT ${limit}`,
            maxRows: limit
        });
        return result.rows;
    }
    async dryRun(request) {
        try {
            await this.runSql(`EXPLAIN USING TEXT ${request.sql}`);
            return {};
        }
        catch (error) {
            return {
                warnings: [error instanceof Error ? error.message : String(error)]
            };
        }
    }
    async execute(request) {
        const startedAt = Date.now();
        try {
            const rows = await this.runSql(request.sql);
            return {
                requestId: request.requestId,
                rows: rows.slice(0, request.maxRows || Number.MAX_SAFE_INTEGER),
                rowCount: rows.length,
                elapsedMs: Date.now() - startedAt
            };
        }
        catch (error) {
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
    async listTableNames() {
        const rows = await this.runSql(`SELECT TABLE_SCHEMA || '.' || TABLE_NAME AS table_id
       FROM ${this.config.database}.INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = '${this.config.schema}'
         AND TABLE_TYPE = 'BASE TABLE'
       ORDER BY TABLE_NAME`);
        return rows.map((row) => String(row.table_id));
    }
    async describeTable(tableId) {
        const [schema, table] = tableId.includes('.') ? tableId.split('.', 2) : [this.config.schema, tableId];
        try {
            const rows = await this.runSql(`SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
         FROM ${this.config.database}.INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = '${schema}'
           AND TABLE_NAME = '${table}'
         ORDER BY ORDINAL_POSITION`);
            const columns = rows.map((row) => ({
                name: String(row.COLUMN_NAME ?? row.column_name),
                type: String(row.DATA_TYPE ?? row.data_type ?? 'TEXT'),
                nullable: String(row.IS_NULLABLE ?? row.is_nullable ?? 'YES').toUpperCase() !== 'NO',
                semanticType: inferSemanticType(String(row.COLUMN_NAME ?? row.column_name), String(row.DATA_TYPE ?? row.data_type ?? 'TEXT'))
            }));
            return buildWarehouseTableProfile({
                tableId: `${schema}.${table}`,
                displayName: table,
                engine: 'snowflake',
                columns
            });
        }
        catch {
            return null;
        }
    }
    async runSql(sql) {
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
exports.SnowflakeConnector = SnowflakeConnector;
class DuckDbConnector {
    constructor(config) {
        this.config = config;
        this.engine = 'duckdb';
        this.virtualTables = config.virtualTables || [];
    }
    async introspect() {
        const tables = this.config.tables?.length
            ? this.config.tables
            : await this.listTableNames();
        const profiles = await Promise.all(tables.map((tableId) => this.describeTable(tableId)));
        return profiles.filter(Boolean);
    }
    async sample(tableId, limit = 20) {
        const result = await this.execute({
            requestId: `sample-${Date.now()}`,
            sql: `SELECT * FROM ${tableId} LIMIT ${limit}`,
            maxRows: limit
        });
        return result.rows;
    }
    async dryRun(request) {
        try {
            await this.runSql(`EXPLAIN ${request.sql}`);
            return {};
        }
        catch (error) {
            return {
                warnings: [error instanceof Error ? error.message : String(error)]
            };
        }
    }
    async execute(request) {
        const startedAt = Date.now();
        try {
            const rows = await this.runSql(request.sql);
            return {
                requestId: request.requestId,
                rows: rows.slice(0, request.maxRows || Number.MAX_SAFE_INTEGER),
                rowCount: rows.length,
                elapsedMs: Date.now() - startedAt
            };
        }
        catch (error) {
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
    async listTableNames() {
        if (this.virtualTables.length > 0) {
            return this.virtualTables.map((table) => table.tableId);
        }
        const rows = await this.runSql('SELECT table_name FROM information_schema.tables WHERE table_schema NOT IN (\'information_schema\', \'pg_catalog\') ORDER BY table_name');
        return rows.map((row) => String(row.table_name));
    }
    async describeTable(tableId) {
        try {
            const virtualTable = this.virtualTables.find((table) => table.tableId === tableId);
            const rows = await this.runSql(virtualTable
                ? `DESCRIBE SELECT * FROM (${virtualTable.sql}) AS ${quoteIdentifier(tableId)}`
                : `DESCRIBE SELECT * FROM ${tableId}`);
            const columns = rows.map((row) => ({
                name: String(row.column_name || row.name),
                type: String(row.column_type || row.type || 'VARCHAR'),
                nullable: String(row.null || row.nullable || 'YES').toUpperCase() !== 'NO',
                semanticType: inferSemanticType(String(row.column_name || row.name), String(row.column_type || row.type || 'VARCHAR'))
            }));
            return buildWarehouseTableProfile({
                tableId,
                displayName: virtualTable?.displayName || tableId,
                engine: 'duckdb',
                columns,
                metadata: virtualTable?.metadata
            });
        }
        catch {
            return null;
        }
    }
    async runSql(sql) {
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
        return Array.isArray(parsed) ? parsed : [];
    }
}
exports.DuckDbConnector = DuckDbConnector;
class PostgresConnector {
    constructor(config) {
        this.config = config;
        this.engine = 'postgres';
    }
    async introspect() {
        const tables = this.config.tables?.length
            ? this.config.tables
            : await this.listTableNames();
        const profiles = await Promise.all(tables.map((tableId) => this.describeTable(tableId)));
        return profiles.filter(Boolean);
    }
    async sample(tableId, limit = 20) {
        const result = await this.execute({
            requestId: `sample-${Date.now()}`,
            sql: `SELECT * FROM ${tableId} LIMIT ${limit}`,
            maxRows: limit
        });
        return result.rows;
    }
    async dryRun(request) {
        try {
            await this.runSql(`EXPLAIN ${request.sql}`);
            return {};
        }
        catch (error) {
            return {
                warnings: [error instanceof Error ? error.message : String(error)]
            };
        }
    }
    async execute(request) {
        const startedAt = Date.now();
        try {
            const rows = await this.runSql(request.sql);
            return {
                requestId: request.requestId,
                rows: rows.slice(0, request.maxRows || Number.MAX_SAFE_INTEGER),
                rowCount: rows.length,
                elapsedMs: Date.now() - startedAt
            };
        }
        catch (error) {
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
    async listTableNames() {
        const schema = this.config.schema || 'public';
        const rows = await this.runSql(`SELECT table_schema || '.' || table_name AS table_id FROM information_schema.tables WHERE table_schema = '${schema}' AND table_type = 'BASE TABLE' ORDER BY table_name`);
        return rows.map((row) => String(row.table_id));
    }
    async describeTable(tableId) {
        const [schema, table] = tableId.includes('.') ? tableId.split('.', 2) : [this.config.schema || 'public', tableId];
        try {
            const rows = await this.runSql(`SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_schema = '${schema}' AND table_name = '${table}'
         ORDER BY ordinal_position`);
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
        }
        catch {
            return null;
        }
    }
    async runSql(sql) {
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
exports.PostgresConnector = PostgresConnector;
const createSqlFunctionConnector = (config) => (new SqlFunctionConnector(config));
exports.createSqlFunctionConnector = createSqlFunctionConnector;
const createBigQueryConnector = (config) => (new BigQueryConnector(config));
exports.createBigQueryConnector = createBigQueryConnector;
const createSnowflakeConnector = (config) => (new SnowflakeConnector(config));
exports.createSnowflakeConnector = createSnowflakeConnector;
const createDuckDbConnector = (config) => (new DuckDbConnector(config));
exports.createDuckDbConnector = createDuckDbConnector;
const createPostgresConnector = (config) => (new PostgresConnector(config));
exports.createPostgresConnector = createPostgresConnector;
const inferSemanticType = (columnName, columnType) => {
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
const buildWarehouseTableProfile = (input) => {
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
const parseCsv = (text) => {
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
        return headers.reduce((accumulator, header, index) => {
            accumulator[header] = values[index] ?? null;
            return accumulator;
        }, {});
    });
};
const parseCsvLine = (line) => {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        if (char === '"') {
            if (inQuotes && line[index + 1] === '"') {
                current += '"';
                index += 1;
            }
            else {
                inQuotes = !inQuotes;
            }
        }
        else if (char === ',' && !inQuotes) {
            values.push(current);
            current = '';
        }
        else {
            current += char;
        }
    }
    values.push(current);
    return values;
};
const quoteIdentifier = (value) => (`"${String(value).replace(/"/g, '""')}"`);
