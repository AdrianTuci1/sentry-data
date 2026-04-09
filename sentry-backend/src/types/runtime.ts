import { ParrotRuntimeMode } from './parrot';
import { ObjectStorageConfig, SourceDataCursor, SourceStorageMetrics } from './storage';

export interface RuntimeSourceDescriptor {
    sourceId?: string;
    sourceName: string;
    uri: string;
    type?: string;
    connectorId?: string;
    storageConfig?: ObjectStorageConfig;
    dataCursor?: SourceDataCursor;
    observedMetrics?: SourceStorageMetrics;
}

export interface RuntimeContext {
    tenantId: string;
    projectId: string;
    rawSourceUris: string[];
    sourceNames: string[];
    sourceDescriptors?: RuntimeSourceDescriptor[];
    runtimeMode?: ParrotRuntimeMode;
    requestId?: string;
    executionScoreUri?: string;
    progressFileUri?: string;
    forceRediscover?: boolean;
    invalidatedSources?: string[];
    discovery?: RuntimeDiscovery;
    runtimeConfig?: {
        enableMlLab?: boolean;
    };
}

export interface RuntimeVitals {
    runtimeLatencyMs: number;
    pathUsed: 'parrot_os';
    cacheHitRate: number;
    estimatedTokensUsed: number;
    tasksExecuted: string[];
    startedAt: string;
    completedAt: string;
}

export interface RuntimeDiscovery {
    connector: any[];
    actionType: any[];
    adjustedData: any[];
    group: any[];
    insight: any[];
    tables: any[];
    metricGroups: any[];
    predictionModels: any[];
    advancedAnalytics: any[];
    sourceClassifications?: any[];
}
