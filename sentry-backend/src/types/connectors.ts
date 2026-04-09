export type ConnectorCategory = 'object_storage' | 'managed_ingestion' | 'database' | 'streaming';
export type ConnectorSupportLevel = 'ready' | 'assisted' | 'planned';
export type ConnectorFrontendAction = 'configure_object_storage' | 'ops_assisted' | 'coming_soon';
export type ConnectorDiscoveryMode = 'bucket_prefix_scan' | 'landing_zone_scan' | 'manual_registration' | 'not_available';
export type ConnectorFieldSemanticType = 'id' | 'timestamp' | 'metric' | 'dimension';

export interface ConnectorFieldDefinition {
    canonicalName: string;
    label: string;
    semanticType: ConnectorFieldSemanticType;
    aliases: string[];
    required?: boolean;
    description?: string;
}

export interface ConnectorProfileDefinition {
    id: string;
    name: string;
    iconPath: string;
    sourceType: string;
    description: string;
    fields: ConnectorFieldDefinition[];
}

export interface ConnectorCatalogEntry {
    id: string;
    name: string;
    description: string;
    category: ConnectorCategory;
    supportLevel: ConnectorSupportLevel;
    sourceType: string;
    connectionStrategy: 'user_owned_storage' | 'managed_bucket_landing' | 'direct_database' | 'streaming_topic';
    frontendAction: ConnectorFrontendAction;
    discoveryMode: ConnectorDiscoveryMode;
    requiresCredentials: boolean;
    supportsAutoDiscovery: boolean;
    supportsRuntimeRefresh: boolean;
    iconPath?: string;
    supportedProfiles?: ConnectorProfileDefinition[];
    notes: string[];
}

export interface DiscoveredStorageSource {
    id: string;
    sourceName: string;
    prefix?: string;
    uri: string;
    objectCount: number;
    totalBytes: number;
    latestModifiedAt?: string;
    sampleKeys: string[];
    detectionMode: 'single_prefix' | 'child_prefixes';
    fileFormat: 'parquet' | 'csv' | 'json';
}
