import { PNEHostContext, PNEInterpretedIntent, PNERuntime } from '@statsparrot/pne-core';
export interface CodexWarehouseSource {
    sourceId: string;
    sourceName: string;
    engine: 'bigquery' | 'snowflake' | 'duckdb' | 'postgres' | 'custom';
    tableId?: string;
    uri?: string;
    domain?: string;
    columns: Array<{
        name: string;
        type: string;
        semanticType?: string;
    }>;
    metricCandidates?: string[];
    entityKeyCandidates?: string[];
    timestampCandidates?: string[];
    sampleRows?: Record<string, unknown>[];
}
export interface CodexPNERequest {
    requestId: string;
    question: string;
    conversation?: Array<{
        role: 'user' | 'assistant' | 'system';
        content: string;
    }>;
    sources: CodexWarehouseSource[];
    domain?: string;
    mode?: 'answer' | 'explore' | 'dashboard' | 'sql' | 'diagnose';
    hostContext?: PNEHostContext;
    interpretedIntent?: PNEInterpretedIntent;
}
export interface CodexPNEResponse {
    requestId: string;
    answer: string;
    sqlBlocks: Array<{
        queryId: string;
        title: string;
        sql: string;
        purpose: string;
    }>;
    caveats: string[];
    followUps: string[];
    evidence: unknown[];
    nextActions?: Array<{
        type: string;
        message: string;
        payload?: Record<string, unknown>;
    }>;
    agentPackage?: {
        status: string;
        hostSurface?: string;
        nextActions: Array<{
            type: string;
            message: string;
            payload?: Record<string, unknown>;
        }>;
    };
    raw: unknown;
}
export interface CodexPNEClient {
    analyze(request: CodexPNERequest): Promise<CodexPNEResponse>;
}
export interface CodexAdapterOptions {
    defaultMode?: CodexPNERequest['mode'];
    maxQueries?: number;
}
export type AgentSurface = 'codex' | 'copilot' | 'antigravity' | 'claude-code' | 'api' | 'mcp' | 'cli';
export interface AgentSurfaceRequest {
    surface: AgentSurface;
    request: CodexPNERequest;
    metadata?: Record<string, unknown>;
}
export interface PNEToolCallEnvelope {
    toolName: 'pne_analyze_question';
    arguments: CodexPNERequest;
}
export interface PNEToolSpec {
    name: 'pne_get_capabilities' | 'pne_get_setup_guide' | 'pne_get_session_state' | 'pne_reset_session_state' | 'pne_get_first_run_playbook' | 'pne_get_project_memory' | 'pne_update_project_memory' | 'pne_reset_project_memory' | 'pne_get_recommended_next_steps' | 'pne_plan_ml_model' | 'pne_build_ml_experiment_contract' | 'pne_export_contract' | 'pne_list_contract_versions' | 'pne_check_local_prerequisites' | 'pne_list_configured_connectors' | 'pne_configure_connector' | 'pne_test_connector' | 'pne_execute_sql' | 'pne_get_widget_catalog' | 'pne_resolve_widget_contract' | 'pne_build_powerbi_query' | 'pne_build_powerbi_dataset' | 'pne_get_account_snapshot' | 'pne_get_environment_status' | 'pne_get_connector_catalog' | 'pne_list_workspaces' | 'pne_create_workspace' | 'pne_get_workspace_detail' | 'pne_get_workspace_members' | 'pne_get_workspace_invitations' | 'pne_create_workspace_invitation' | 'pne_get_workspace_activity' | 'pne_list_projects' | 'pne_create_project' | 'pne_update_project' | 'pne_get_project_status' | 'pne_list_project_share_links' | 'pne_create_project_share_link' | 'pne_list_project_sources' | 'pne_add_project_source' | 'pne_delete_project_source' | 'pne_get_project_lineage' | 'pne_get_project_analytics' | 'pne_get_project_formulas' | 'pne_get_project_overrides' | 'pne_list_project_recommendations' | 'pne_train_project_recommendation' | 'pne_run_project_runtime' | 'pne_list_runtime_requests' | 'pne_get_runtime_request_status' | 'pne_get_runtime_request_artifacts' | 'pne_poll_runtime_request' | 'pne_check_project_updates' | 'pne_discover_project_sources' | 'pne_create_project_override' | 'pne_record_sentinel_feedback' | 'pne_get_dashboard_data' | 'pne_get_dashboard_manifest' | 'pne_get_dashboard_widget_data' | 'pne_reload_widget_registry' | 'pne_preview_workspace_invitation' | 'pne_accept_workspace_invitation' | 'pne_get_shared_project' | 'pne_list_sources' | 'pne_get_resource_snapshot' | 'pne_analyze_question';
    description: string;
}
export interface PNEHttpClientOptions {
    endpoint: string;
    headers?: Record<string, string>;
    fetchImpl?: typeof fetch;
}
export declare class PNEHttpClient implements CodexPNEClient {
    private readonly options;
    constructor(options: PNEHttpClientOptions);
    analyze(request: CodexPNERequest): Promise<CodexPNEResponse>;
}
export declare class PNELocalRuntimeClient implements CodexPNEClient {
    private readonly runtime;
    constructor(runtime: PNERuntime);
    analyze(request: CodexPNERequest): Promise<CodexPNEResponse>;
}
export declare class CodexAdapter {
    private readonly client;
    private readonly options;
    constructor(client: CodexPNEClient, options?: CodexAdapterOptions);
    ask(request: CodexPNERequest): Promise<CodexPNEResponse>;
    formatMarkdown(response: CodexPNEResponse): string;
    private formatSqlBlocks;
    private formatCaveats;
    private formatFollowUps;
    private formatNextActions;
}
export declare class AgentSurfaceAdapter {
    private readonly codexAdapter;
    constructor(codexAdapter: CodexAdapter);
    describeTools(): PNEToolSpec[];
    toToolCallEnvelope(input: AgentSurfaceRequest): PNEToolCallEnvelope;
    handle(input: AgentSurfaceRequest): Promise<{
        surface: AgentSurface;
        response: CodexPNEResponse;
        markdown: string;
    }>;
}
export declare const createCodexAdapter: (client: CodexPNEClient, options?: CodexAdapterOptions) => CodexAdapter;
export declare const createAgentSurfaceAdapter: (client: CodexPNEClient, options?: CodexAdapterOptions) => AgentSurfaceAdapter;
