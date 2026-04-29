import { WarehouseConnector, WarehouseQueryResult } from '@statsparrot/connector-sdk';
import { ObservationSink } from '@statsparrot/observability';
import { SentinelCore } from '@statsparrot/sentinel-core';
export type PNEIntentMode = 'answer' | 'explore' | 'dashboard' | 'sql' | 'diagnose';
export type PNEHostSurface = 'codex' | 'copilot' | 'antigravity' | 'claude-code' | 'api' | 'mcp' | 'cli' | 'hosted';
export interface PNEConversationTurn {
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt?: string;
}
export interface PNEWarehouseSource {
    sourceId: string;
    sourceName: string;
    engine: 'bigquery' | 'snowflake' | 'duckdb' | 'postgres' | 'custom';
    tableId?: string;
    uri?: string;
    domain?: string;
    columns: Array<{
        name: string;
        type: string;
        semanticType?: 'id' | 'timestamp' | 'metric' | 'dimension' | 'json' | 'unknown';
    }>;
    metricCandidates?: string[];
    entityKeyCandidates?: string[];
    timestampCandidates?: string[];
    sampleRows?: Record<string, unknown>[];
    metadata?: Record<string, unknown>;
}
export interface PNEHostContext {
    surface: PNEHostSurface;
    agentName?: string;
    modelName?: string;
    sessionId?: string;
    userIntentSummary?: string;
    capabilities?: string[];
    metadata?: Record<string, unknown>;
}
export interface PNEInterpretedIntent {
    goal?: string;
    metrics?: string[];
    dimensions?: string[];
    timeframe?: string;
    filters?: string[];
    expectedDeliverable?: 'answer' | 'sql' | 'plan' | 'dashboard';
    unresolvedQuestions?: string[];
    confidence?: number;
}
export interface PNEAnalysisIntent {
    requestId: string;
    tenantId?: string;
    projectId?: string;
    mode: PNEIntentMode;
    question: string;
    conversation?: PNEConversationTurn[];
    sources: PNEWarehouseSource[];
    domain?: string;
    hostContext?: PNEHostContext;
    interpretedIntent?: PNEInterpretedIntent;
    constraints?: {
        maxQueries?: number;
        maxBytesProcessed?: number;
        allowCharts?: boolean;
        requireSql?: boolean;
        requireEvidence?: boolean;
    };
}
export interface PNEPlannedQuery {
    queryId: string;
    title: string;
    sourceId: string;
    sql: string;
    purpose: string;
    expectedShape: 'scalar' | 'table' | 'timeseries' | 'categorical_breakdown' | 'unknown';
    dependencies: {
        columns: string[];
    };
    confidence?: number;
    caveats?: string[];
}
export interface PNEEvidenceItem {
    queryId: string;
    title: string;
    summary: string;
    rowCount?: number;
    preview?: Record<string, unknown>[];
}
export interface PNEInsight {
    insightId: string;
    title: string;
    answer: string;
    sourceIds: string[];
    queryIds: string[];
    confidence: number;
    caveats: string[];
    visualization?: {
        type: string;
        data: Record<string, unknown>;
    };
}
export interface PNEAnalysisPlan {
    requestId: string;
    mode: PNEIntentMode;
    question: string;
    plannedQueries: PNEPlannedQuery[];
    missingInputs: Array<{
        metric: string;
        reason: string;
        requiredColumns: string[];
    }>;
    followUpQuestions: string[];
}
export interface PNENextAction {
    type: 'ask_user' | 'inspect_sources' | 'run_queries' | 'connect_warehouse' | 'switch_to_hosted';
    message: string;
    payload?: Record<string, unknown>;
}
export interface PNEAnalysisResult {
    requestId: string;
    answer: string;
    plan: PNEAnalysisPlan;
    insights: PNEInsight[];
    evidence: PNEEvidenceItem[];
    sql: PNEPlannedQuery[];
    nextActions?: PNENextAction[];
    agentPackage?: {
        status: 'ready' | 'needs_clarification' | 'needs_connection';
        hostSurface?: PNEHostSurface;
        nextActions: PNENextAction[];
    };
    sentinel?: {
        signals: unknown[];
        hints: unknown[];
    };
    observability?: Record<string, unknown>;
}
export interface PNEPlanner {
    plan(intent: PNEAnalysisIntent): Promise<PNEAnalysisPlan>;
    answer(intent: PNEAnalysisIntent): Promise<PNEAnalysisResult>;
}
export interface PNERuntimeOptions {
    connector: WarehouseConnector;
    sentinel?: SentinelCore;
    observationSinks?: ObservationSink[];
    executeQueries?: boolean;
}
export interface PNERuntimeExecution {
    query: PNEPlannedQuery;
    result: WarehouseQueryResult;
}
export declare class CapabilityAwarePlanner implements PNEPlanner {
    plan(intent: PNEAnalysisIntent): Promise<PNEAnalysisPlan>;
    answer(intent: PNEAnalysisIntent): Promise<PNEAnalysisResult>;
    private detectRequestedMetrics;
    private findMissingInputs;
    private planSourceQueries;
    private planJoinQueries;
    private pickMetric;
    private pickDimension;
    private pickSharedJoinKey;
    private hasColumn;
    private buildFollowUps;
}
export declare const createPNEPlanner: () => CapabilityAwarePlanner;
export declare class PNERuntime {
    private readonly options;
    private readonly planner;
    private readonly sentinel;
    constructor(options: PNERuntimeOptions);
    analyze(input: Omit<PNEAnalysisIntent, 'sources'> & {
        sources?: PNEWarehouseSource[];
    }): Promise<PNEAnalysisResult>;
    private loadSources;
    private fromTableProfile;
    private reviewPlan;
    private executePlan;
    private toEvidence;
    private toInsights;
    private composeAnswer;
    private buildNextActions;
}
export declare const createPNERuntime: (options: PNERuntimeOptions) => PNERuntime;
