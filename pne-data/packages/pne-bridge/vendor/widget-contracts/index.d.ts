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
export declare const coerceWidgetContract: (raw: Record<string, unknown>) => WidgetContractDefinition;
export declare const resolveWidgetCatalogEntry: (widgetType: string | undefined, catalogEntries?: Array<Record<string, unknown>>) => WidgetContractDefinition | undefined;
export declare const resolveWidgetContract: (input: WidgetContractResolutionInput) => WidgetQueryContract;
