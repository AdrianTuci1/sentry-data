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
export declare const buildPowerBIQueryDefinition: (input: {
    queryName: string;
    nativeSql: string;
    bridgeUrl?: string;
    connectorId?: string;
    widgetContract?: WidgetQueryContract;
}) => PowerBIQueryDefinition;
export declare const buildPowerBIDatasetDefinition: (input: {
    datasetName: string;
    queries: PowerBIQueryDefinition[];
}) => PowerBIDatasetDefinition;
