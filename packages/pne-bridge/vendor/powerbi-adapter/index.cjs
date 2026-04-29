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
const generateDaxMeasure = (alias, widgetId) => {
    const normalized = alias.toLowerCase();
    if (normalized.includes('revenue') || normalized.includes('price') || normalized.includes('amount')) {
        return `SUM('${alias}')`;
    }
    if (normalized.includes('count') || normalized.includes('total')) {
        return `COUNT('${alias}')`;
    }
    return `AVERAGE('${alias}')`;
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
    const measures = columns
        .filter((col) => col.role === 'measure')
        .map((col) => ({
        name: `Total ${col.name}`,
        expression: generateDaxMeasure(col.name, input.widgetContract?.widget.id)
    }));
    let powerQueryM;
    if (input.mode === 'live_bridge') {
        const bridgeUrl = input.bridgeUrl || 'http://127.0.0.1:8765';
        const requestBody = JSON.stringify({
            toolName: 'pne_execute_sql',
            connectorId: input.connectorId,
            arguments: {
                connectorId: input.connectorId,
                sql: input.nativeSql
            }
        });
        powerQueryM = [
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
    }
    return {
        version: 2,
        mode: input.mode,
        queryName: input.queryName,
        nativeSql: input.nativeSql,
        powerQueryM,
        columns,
        measures,
        notes: [
            `Mode: ${input.mode}`,
            input.mode === 'live_bridge' ? 'Route queries through PNE Bridge.' : 'Native warehouse connection.'
        ]
    };
};
exports.buildPowerBIQueryDefinition = buildPowerBIQueryDefinition;
const buildPowerBIDatasetDefinition = (input) => {
    const visuals = input.queries.map((q, idx) => ({
        visualId: `visual_${idx}`,
        type: q.measures.length > 0 ? 'card' : 'table',
        title: q.queryName,
        x: (idx % 2) * 400,
        y: Math.floor(idx / 2) * 300,
        width: 380,
        height: 280,
        bindings: {
            'Values': q.measures.map((m) => m.name),
            'Columns': q.columns.filter((c) => c.role !== 'measure').map((c) => c.name)
        }
    }));
    return {
        version: 2,
        datasetName: input.datasetName,
        mode: input.mode,
        tables: input.queries.map((query) => ({
            name: query.queryName,
            query
        })),
        relationships: input.relationships || [],
        pages: [
            {
                name: 'main_page',
                displayName: 'PNE Analysis Overview',
                visuals
            }
        ],
        bridgeConfig: input.mode === 'live_bridge' ? {
            endpoint: input.bridgeUrl || 'http://127.0.0.1:8765',
            authType: 'none',
            timeoutMs: 30000,
            enableCaching: true
        } : undefined
    };
};
exports.buildPowerBIDatasetDefinition = buildPowerBIDatasetDefinition;
