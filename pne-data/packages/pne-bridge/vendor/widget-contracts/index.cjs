"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveWidgetContract = exports.resolveWidgetCatalogEntry = exports.coerceWidgetContract = void 0;
const normalizeLookupKey = (value) => String(value || '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[_\s/]+/g, '-')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
const arrayOfStrings = (value) => (Array.isArray(value)
    ? value.map((item) => String(item)).filter(Boolean)
    : []);
const normalizeSqlAliases = (value) => (Array.isArray(value)
    ? value
        .filter((item) => item && typeof item === 'object')
        .map((item) => ({
        alias: String(item.alias || ''),
        path: typeof item.path === 'string' ? String(item.path) : undefined,
        required: item.required !== false,
        sql_type: typeof item.sql_type === 'string'
            ? String(item.sql_type)
            : typeof item.sqlType === 'string'
                ? String(item.sqlType)
                : undefined,
        expression_hint: typeof item.expression_hint === 'string'
            ? String(item.expression_hint)
            : typeof item.expressionHint === 'string'
                ? String(item.expressionHint)
                : undefined,
        description: typeof item.description === 'string'
            ? String(item.description)
            : undefined
    }))
        .filter((alias) => alias.alias)
    : []);
const coerceWidgetContract = (raw) => ({
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
        ? raw.dataStructureTemplate
        : typeof raw.data_structure_template === 'object' && raw.data_structure_template
            ? raw.data_structure_template
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
exports.coerceWidgetContract = coerceWidgetContract;
const resolveWidgetCatalogEntry = (widgetType, catalogEntries = []) => {
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
    return match ? (0, exports.coerceWidgetContract)(match) : undefined;
};
exports.resolveWidgetCatalogEntry = resolveWidgetCatalogEntry;
const extractProvidedFields = (rows) => {
    if (!rows) {
        return [];
    }
    if (Array.isArray(rows)) {
        const first = rows[0];
        return first && typeof first === 'object' ? Object.keys(first) : [];
    }
    return typeof rows === 'object' ? Object.keys(rows) : [];
};
const resolveWidgetContract = (input) => {
    const inline = input.inlineContract && typeof input.inlineContract === 'object'
        ? (0, exports.coerceWidgetContract)(input.inlineContract)
        : undefined;
    const catalog = (0, exports.resolveWidgetCatalogEntry)(input.widgetType, (input.catalogEntries || []));
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
exports.resolveWidgetContract = resolveWidgetContract;
