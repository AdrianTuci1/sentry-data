export type PipelinePath = 'hot' | 'cold' | 'ml';

export interface PipelineContext {
    tenantId: string;
    projectId: string;
    rawSourceUris: string[];
    sourceNames: string[];
    forceRediscover?: boolean;
    invalidatedSources?: string[];
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
    tables: any[];
    metricGroups: any[];
    predictionModels: any[];
    advancedAnalytics: any[];
    dashboardGroups: any[];
    dashboards: any[];
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
    systemPromptUri: string;
    boilerplateUri: string;
    additionalEnvVars: Record<string, string>;
    forceRegenerate?: boolean;
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
