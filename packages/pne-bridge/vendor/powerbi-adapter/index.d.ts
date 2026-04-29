import { WidgetQueryContract } from '@statsparrot/widget-contracts';
export type PowerBIMode = 'model_only' | 'model_layout' | 'live_bridge';
export interface PowerBIMeasureDefinition {
    name: string;
    expression: string;
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
    type: string;
    title: string;
    x: number;
    y: number;
    width: number;
    height: number;
    bindings: Record<string, string[]>;
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
export declare const buildPowerBIQueryDefinition: (input: {
    mode: PowerBIMode;
    queryName: string;
    nativeSql?: string;
    bridgeUrl?: string;
    connectorId?: string;
    widgetContract?: WidgetQueryContract;
}) => PowerBIQueryDefinition;
export declare const buildPowerBIDatasetDefinition: (input: {
    datasetName: string;
    mode: PowerBIMode;
    queries: PowerBIQueryDefinition[];
    relationships?: PowerBIRelationshipDefinition[];
    bridgeUrl?: string;
}) => PowerBIDatasetDefinition;
