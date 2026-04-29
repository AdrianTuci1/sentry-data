export interface WidgetSqlAlias {
  alias: string;
  path?: string;
  required?: boolean;
  sql_type?: string;
  expression_hint?: string;
  description?: string;
}

export interface WidgetContractDefinition {
  id: string;
  title: string;
  component?: string;
  category?: string;
  runtimeType?: string;
  manifestPath?: string;
  description?: string;
  selectionHints?: string[];
  mappingMode?: string;
  sqlShape?: string;
  dataRequirements?: string[];
  sqlAliases: WidgetSqlAlias[];
  dataStructureTemplate?: Record<string, unknown>;
  defaultGridSpan?: string;
  defaultColorTheme?: string;
  componentIdOverrides?: string[];
}

export interface WidgetContractResolutionInput {
  widgetType?: string;
  inlineContract?: Partial<WidgetContractDefinition> | null;
  catalogEntries?: Array<Record<string, unknown>>;
  query?: {
    queryId?: string;
    title?: string;
    sql?: string;
    sourceId?: string;
    expectedShape?: string;
  };
  rows?: Record<string, unknown>[] | Record<string, unknown> | null;
}

export interface WidgetQueryContract {
  version: 1;
  source: 'catalog_manifest' | 'inline_contract' | 'fallback';
  widget: WidgetContractDefinition;
  query?: {
    queryId?: string;
    title?: string;
    sql?: string;
    sourceId?: string;
    expectedShape?: string;
  };
  requiredAliases: string[];
  optionalAliases: string[];
  payloadCompatibility: {
    valid: boolean;
    providedFields: string[];
    missingRequiredFields: string[];
  };
}

const normalizeLookupKey = (value: unknown): string => String(value || '')
  .trim()
  .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
  .replace(/[_\s/]+/g, '-')
  .replace(/[^a-zA-Z0-9-]+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '')
  .toLowerCase();

const arrayOfStrings = (value: unknown): string[] => (
  Array.isArray(value)
    ? value.map((item) => String(item)).filter(Boolean)
    : []
);

const normalizeSqlAliases = (value: unknown): WidgetSqlAlias[] => (
  Array.isArray(value)
    ? value
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({
        alias: String((item as Record<string, unknown>).alias || ''),
        path: typeof (item as Record<string, unknown>).path === 'string' ? String((item as Record<string, unknown>).path) : undefined,
        required: (item as Record<string, unknown>).required !== false,
        sql_type: typeof (item as Record<string, unknown>).sql_type === 'string'
          ? String((item as Record<string, unknown>).sql_type)
          : typeof (item as Record<string, unknown>).sqlType === 'string'
            ? String((item as Record<string, unknown>).sqlType)
            : undefined,
        expression_hint: typeof (item as Record<string, unknown>).expression_hint === 'string'
          ? String((item as Record<string, unknown>).expression_hint)
          : typeof (item as Record<string, unknown>).expressionHint === 'string'
            ? String((item as Record<string, unknown>).expressionHint)
            : undefined,
        description: typeof (item as Record<string, unknown>).description === 'string'
          ? String((item as Record<string, unknown>).description)
          : undefined
      }))
      .filter((alias) => alias.alias)
    : []
);

export const coerceWidgetContract = (raw: Record<string, unknown>): WidgetContractDefinition => ({
  id: String(raw.id || raw.runtime_type || raw.runtimeType || 'unknown-widget'),
  title: String(raw.title || raw.id || raw.runtime_type || 'Unknown Widget'),
  component: typeof raw.component === 'string' ? raw.component : undefined,
  category: typeof raw.category === 'string' ? raw.category : undefined,
  runtimeType: typeof raw.runtimeType === 'string'
    ? raw.runtimeType
    : typeof raw.runtime_type === 'string'
      ? raw.runtime_type
      : undefined,
  manifestPath: typeof raw.manifestPath === 'string'
    ? raw.manifestPath
    : typeof raw.manifest_path === 'string'
      ? raw.manifest_path
      : undefined,
  description: typeof raw.description === 'string' ? raw.description : undefined,
  selectionHints: arrayOfStrings(raw.selectionHints ?? raw.selection_hints),
  mappingMode: typeof raw.mappingMode === 'string'
    ? raw.mappingMode
    : typeof raw.mapping_mode === 'string'
      ? raw.mapping_mode
      : undefined,
  sqlShape: typeof raw.sqlShape === 'string'
    ? raw.sqlShape
    : typeof raw.sql_shape === 'string'
      ? raw.sql_shape
      : undefined,
  dataRequirements: arrayOfStrings(raw.dataRequirements ?? raw.data_requirements),
  sqlAliases: normalizeSqlAliases(raw.sqlAliases ?? raw.sql_aliases),
  dataStructureTemplate: typeof raw.dataStructureTemplate === 'object' && raw.dataStructureTemplate
    ? raw.dataStructureTemplate as Record<string, unknown>
    : typeof raw.data_structure_template === 'object' && raw.data_structure_template
      ? raw.data_structure_template as Record<string, unknown>
      : undefined,
  defaultGridSpan: typeof raw.defaultGridSpan === 'string'
    ? raw.defaultGridSpan
    : typeof raw.default_grid_span === 'string'
      ? raw.default_grid_span
      : undefined,
  defaultColorTheme: typeof raw.defaultColorTheme === 'string'
    ? raw.defaultColorTheme
    : typeof raw.default_color_theme === 'string'
      ? raw.default_color_theme
      : undefined,
  componentIdOverrides: arrayOfStrings(raw.componentIdOverrides ?? raw.component_id_overrides)
});

export const resolveWidgetCatalogEntry = (
  widgetType: string | undefined,
  catalogEntries: Array<Record<string, unknown>> = []
): WidgetContractDefinition | undefined => {
  if (!widgetType) {
    return undefined;
  }

  const normalized = normalizeLookupKey(widgetType);
  const match = catalogEntries.find((entry) => {
    const candidates = [
      entry.id,
      entry.runtime_type,
      entry.runtimeType,
      ...(Array.isArray(entry.aliases) ? entry.aliases : [])
    ].map(normalizeLookupKey);
    return candidates.includes(normalized);
  });

  return match ? coerceWidgetContract(match) : undefined;
};

const extractProvidedFields = (rows: Record<string, unknown>[] | Record<string, unknown> | null | undefined): string[] => {
  if (!rows) {
    return [];
  }

  if (Array.isArray(rows)) {
    const first = rows[0];
    return first && typeof first === 'object' ? Object.keys(first) : [];
  }

  return typeof rows === 'object' ? Object.keys(rows) : [];
};

export const resolveWidgetContract = (input: WidgetContractResolutionInput): WidgetQueryContract => {
  const inline = input.inlineContract && typeof input.inlineContract === 'object'
    ? coerceWidgetContract(input.inlineContract as Record<string, unknown>)
    : undefined;
  const catalog = resolveWidgetCatalogEntry(input.widgetType, (input.catalogEntries || []) as Array<Record<string, unknown>>);
  const widget = inline || catalog || {
    id: input.widgetType || 'generic-table',
    title: input.widgetType || 'Generic Table',
    sqlAliases: []
  };
  const requiredAliases = widget.sqlAliases.filter((alias) => alias.required !== false).map((alias) => alias.alias);
  const optionalAliases = widget.sqlAliases.filter((alias) => alias.required === false).map((alias) => alias.alias);
  const providedFields = extractProvidedFields(input.rows);
  const missingRequiredFields = requiredAliases.filter((alias) => !providedFields.includes(alias));

  return {
    version: 1,
    source: inline ? 'inline_contract' : catalog ? 'catalog_manifest' : 'fallback',
    widget,
    query: input.query,
    requiredAliases,
    optionalAliases,
    payloadCompatibility: {
      valid: missingRequiredFields.length === 0,
      providedFields,
      missingRequiredFields
    }
  };
};
