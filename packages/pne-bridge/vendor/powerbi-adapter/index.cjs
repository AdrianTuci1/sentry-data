"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPowerBIDatasetDefinition = exports.buildPowerBIQueryDefinition = void 0;
const normalizeSqlType = (value) => {
    const normalized = String(value || '').toLowerCase();
    if (normalized.includes('bool'))
        return 'boolean';
    if (normalized.includes('time') || normalized.includes('date'))
        return 'datetime';
    if (/(int|decimal|double|float|numeric|number|bigint|real)/.test(normalized))
        return 'number';
    if (normalized.includes('string') || normalized.includes('text') || normalized.includes('char') || normalized.includes('varchar'))
        return 'text';
    return 'any';
};
const inferRole = (alias, type) => {
    const normalized = alias.toLowerCase();
    if (normalized.endsWith('_id') || normalized === 'id')
        return 'identifier';
    if (normalized.includes('date') || normalized.includes('time') || type === 'datetime')
        return 'time';
    if (type === 'number')
        return 'measure';
    if (type === 'text')
        return 'dimension';
    return 'unknown';
};
const suggestVisual = (contract) => {
    const widgetId = contract?.widget.id || '';
    const category = contract?.widget.category || '';
    if (widgetId === 'metric-trend' || widgetId === 'weather' || widgetId === 'natural') {
        return { visualType: 'card', suggestedFields: contract?.requiredAliases || [] };
    }
    if (widgetId === 'sparkline-stat' || widgetId === 'live-traffic') {
        return { visualType: 'lineChart', suggestedFields: contract?.requiredAliases || [] };
    }
    if (widgetId === 'campaign-list' || widgetId === 'mpl-benchmark-bars' || category === 'lists') {
        return { visualType: 'clusteredBarChart', suggestedFields: contract?.requiredAliases || [] };
    }
    return { visualType: 'table', suggestedFields: contract?.requiredAliases || [] };
};
const buildPowerBIQueryDefinition = (input) => {
    const columns = (input.widgetContract?.widget.sqlAliases || []).map((alias) => {
        const type = normalizeSqlType(alias.sql_type);
        return {
            name: alias.alias,
            type,
            role: inferRole(alias.alias, type)
        };
    });
    const bridgeUrl = input.bridgeUrl || 'http://127.0.0.1:8765';
    const requestBody = JSON.stringify({
        toolName: 'pne_execute_sql',
        connectorId: input.connectorId,
        arguments: {
            connectorId: input.connectorId,
            sql: input.nativeSql
        }
    });
    const powerQueryM = [
        'let',
        `    Source = Json.Document(Web.Contents("${bridgeUrl}", [`,
        '        RelativePath = "/tool",',
        '        Headers = [#"Content-Type" = "application/json"],',
        `        Content = Text.ToBinary(${JSON.stringify(requestBody)})`,
        '    ])),',
        '    Rows = if Record.HasFields(Source, "rows") then Source[rows] else {},',
        '    Output = if Value.Is(Rows, type list) then Table.FromRecords(Rows) else #table({}, {})',
        'in',
        '    Output'
    ].join('\n');
    return {
        version: 1,
        queryName: input.queryName,
        sourceMode: 'pne-http',
        nativeSql: input.nativeSql,
        powerQueryM,
        columns,
        widgetBinding: suggestVisual(input.widgetContract),
        notes: [
            'This definition expects the PNE bridge HTTP server to be reachable by PowerBI.',
            'Once projections and serving tables are materialized, the BI layer can switch to native warehouse SQL and stop routing through the LLM.'
        ]
    };
};
exports.buildPowerBIQueryDefinition = buildPowerBIQueryDefinition;
const buildPowerBIDatasetDefinition = (input) => ({
    version: 1,
    datasetName: input.datasetName,
    tables: input.queries.map((query) => ({
        name: query.queryName,
        query
    })),
    relationships: []
});
exports.buildPowerBIDatasetDefinition = buildPowerBIDatasetDefinition;
