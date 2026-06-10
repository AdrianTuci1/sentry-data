"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBigQueryConnector = exports.createSqlFunctionConnector = exports.BigQueryConnector = exports.SqlFunctionConnector = exports.ConnectorRegistry = void 0;
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
        if (!this.config.client?.getDatasets) {
            return [];
        }
        await this.config.client.getDatasets();
        return [];
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
            return {
                warnings: ['bigquery_client_not_configured']
            };
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
            return {
                requestId: request.requestId,
                rows: [],
                rowCount: 0,
                elapsedMs: Date.now() - startedAt,
                error: {
                    code: 'bigquery_client_not_configured',
                    message: 'BigQueryConnector requires a BigQuery-compatible client.'
                }
            };
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
}
exports.BigQueryConnector = BigQueryConnector;
const createSqlFunctionConnector = (config) => (new SqlFunctionConnector(config));
exports.createSqlFunctionConnector = createSqlFunctionConnector;
const createBigQueryConnector = (config) => (new BigQueryConnector(config));
exports.createBigQueryConnector = createBigQueryConnector;
