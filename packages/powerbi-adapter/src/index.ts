import { WidgetQueryContract } from '@statsparrot/widget-contracts';

export interface PowerBIColumnDefinition {
  name: string;
  type: 'text' | 'number' | 'datetime' | 'boolean' | 'any';
  role: 'dimension' | 'measure' | 'time' | 'identifier' | 'unknown';
}

export interface PowerBIQueryDefinition {
  version: 1;
  queryName: string;
  sourceMode: 'pne-http' | 'native-sql';
  nativeSql: string;
  powerQueryM: string;
  columns: PowerBIColumnDefinition[];
  widgetBinding?: {
    visualType: 'card' | 'lineChart' | 'clusteredBarChart' | 'table';
    suggestedFields: string[];
  };
  notes: string[];
}

export interface PowerBIDatasetDefinition {
  version: 1;
  datasetName: string;
  tables: Array<{
    name: string;
    query: PowerBIQueryDefinition;
  }>;
  relationships: Array<{
    fromTable: string;
    fromColumn: string;
    toTable: string;
    toColumn: string;
  }>;
}

const normalizeSqlType = (value?: string): PowerBIColumnDefinition['type'] => {
  const normalized = String(value || '').toLowerCase();
  if (normalized.includes('bool')) return 'boolean';
  if (normalized.includes('time') || normalized.includes('date')) return 'datetime';
  if (/(int|decimal|double|float|numeric|number|bigint|real)/.test(normalized)) return 'number';
  if (normalized.includes('string') || normalized.includes('text') || normalized.includes('char') || normalized.includes('varchar')) return 'text';
  return 'any';
};

const inferRole = (alias: string, type: PowerBIColumnDefinition['type']): PowerBIColumnDefinition['role'] => {
  const normalized = alias.toLowerCase();
  if (normalized.endsWith('_id') || normalized === 'id') return 'identifier';
  if (normalized.includes('date') || normalized.includes('time') || type === 'datetime') return 'time';
  if (type === 'number') return 'measure';
  if (type === 'text') return 'dimension';
  return 'unknown';
};

const suggestVisual = (contract?: WidgetQueryContract): PowerBIQueryDefinition['widgetBinding'] => {
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

export const buildPowerBIQueryDefinition = (input: {
  queryName: string;
  nativeSql: string;
  bridgeUrl?: string;
  connectorId?: string;
  widgetContract?: WidgetQueryContract;
}): PowerBIQueryDefinition => {
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

export const buildPowerBIDatasetDefinition = (input: {
  datasetName: string;
  queries: PowerBIQueryDefinition[];
}): PowerBIDatasetDefinition => ({
  version: 1,
  datasetName: input.datasetName,
  tables: input.queries.map((query) => ({
    name: query.queryName,
    query
  })),
  relationships: []
});
