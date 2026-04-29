import { WidgetQueryContract } from '@statsparrot/widget-contracts';

export type PowerBIMode = 'model_only' | 'model_layout' | 'live_bridge';

export interface PowerBIMeasureDefinition {
  name: string;
  expression: string; // DAX expression
  formatString?: string;
  displayFolder?: string;
  description?: string;
}

export interface PowerBIRelationshipDefinition {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  crossFilteringBehavior?: 'oneDirection' | 'bothDirections';
}

export interface PowerBIColumnDefinition {
  name: string;
  type: 'text' | 'number' | 'datetime' | 'boolean' | 'any';
  role: 'dimension' | 'measure' | 'time' | 'identifier' | 'unknown';
  isHidden?: boolean;
}

export interface PowerBIVisualDefinition {
  visualId: string;
  type: string; // PowerBI visual type (e.g., 'card', 'lineChart')
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  bindings: Record<string, string[]>; // e.g., { 'Values': ['total_revenue'], 'Axis': ['date'] }
}

export interface PowerBIPageDefinition {
  name: string;
  displayName: string;
  visuals: PowerBIVisualDefinition[];
}

export interface PowerBIQueryDefinition {
  version: 2;
  mode: PowerBIMode;
  queryName: string;
  nativeSql?: string;
  powerQueryM?: string;
  columns: PowerBIColumnDefinition[];
  measures: PowerBIMeasureDefinition[];
  notes: string[];
}

export interface PowerBIDatasetDefinition {
  version: 2;
  datasetName: string;
  mode: PowerBIMode;
  tables: Array<{
    name: string;
    query: PowerBIQueryDefinition;
  }>;
  relationships: PowerBIRelationshipDefinition[];
  pages: PowerBIPageDefinition[];
  bridgeConfig?: {
    endpoint: string;
    authType: 'none' | 'api-key' | 'service-principal';
    timeoutMs: number;
    enableCaching: boolean;
  };
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

const generateDaxMeasure = (alias: string, widgetId?: string): string => {
  const normalized = alias.toLowerCase();
  if (normalized.includes('revenue') || normalized.includes('price') || normalized.includes('amount')) {
    return `SUM('${alias}')`;
  }
  if (normalized.includes('count') || normalized.includes('total')) {
    return `COUNT('${alias}')`;
  }
  return `AVERAGE('${alias}')`;
};

export const buildPowerBIQueryDefinition = (input: {
  mode: PowerBIMode;
  queryName: string;
  nativeSql?: string;
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

  const measures: PowerBIMeasureDefinition[] = columns
    .filter((col) => col.role === 'measure')
    .map((col) => ({
      name: `Total ${col.name}`,
      expression: generateDaxMeasure(col.name, input.widgetContract?.widget.id)
    }));

  let powerQueryM: string | undefined;
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

export const buildPowerBIDatasetDefinition = (input: {
  datasetName: string;
  mode: PowerBIMode;
  queries: PowerBIQueryDefinition[];
  relationships?: PowerBIRelationshipDefinition[];
  bridgeUrl?: string;
}): PowerBIDatasetDefinition => {
  const visuals: PowerBIVisualDefinition[] = input.queries.map((q, idx) => ({
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

