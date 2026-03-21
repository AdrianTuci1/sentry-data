export type PipelinePath = 'unified';

export interface PipelineContext {
    tenantId: string;
    projectId: string;
    rawSourceUris: string[];
    sourceNames: string[];
    forceRediscover?: boolean;
    invalidatedSources?: string[];
    discovery?: CumulativeDiscovery;
}

export interface PipelineVitals {
    pipelineLatencyMs: number;
    pathUsed: PipelinePath;
    cacheHitRate: number; // 0 to 1
    estimatedTokensUsed: number;
    tasksExecuted: string[];
    startedAt: string;
    completedAt: string;
}

export interface CumulativeDiscovery {
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

export interface PipelineResult {
    path: PipelinePath;
    discovery: CumulativeDiscovery;
    vitals: PipelineVitals;
}

export interface AgentTaskParams {
    tenantId: string;
    projectId: string;
    taskName: string;
    forceRegenerate?: boolean;
    existingScripts?: Set<string>;
}

export interface AgentTaskResult {
    success: boolean;
    result: any;
    discovery: any;
    logs: string;
    timing: {
        startMs: number;
        endMs: number;
        durationMs: number;
    };
    estimatedTokens: number;
}
