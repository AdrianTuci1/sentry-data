import {
  PNEAnalysisIntent,
  PNEHostContext,
  PNEInterpretedIntent,
  PNERuntime
} from '@statsparrot/pne-core';

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
  name:
    | 'pne_get_capabilities'
    | 'pne_get_setup_guide'
    | 'pne_get_session_state'
    | 'pne_reset_session_state'
    | 'pne_get_first_run_playbook'
    | 'pne_get_project_memory'
    | 'pne_update_project_memory'
    | 'pne_reset_project_memory'
    | 'pne_get_recommended_next_steps'
    | 'pne_plan_ml_model'
    | 'pne_build_ml_experiment_contract'
    | 'pne_export_contract'
    | 'pne_list_contract_versions'
    | 'pne_check_local_prerequisites'
    | 'pne_list_configured_connectors'
    | 'pne_configure_connector'
    | 'pne_test_connector'
    | 'pne_execute_sql'
    | 'pne_get_widget_catalog'
    | 'pne_resolve_widget_contract'
    | 'pne_build_powerbi_query'
    | 'pne_build_powerbi_dataset'
    | 'pne_get_account_snapshot'
    | 'pne_get_environment_status'
    | 'pne_get_connector_catalog'
    | 'pne_list_workspaces'
    | 'pne_create_workspace'
    | 'pne_get_workspace_detail'
    | 'pne_get_workspace_members'
    | 'pne_get_workspace_invitations'
    | 'pne_create_workspace_invitation'
    | 'pne_get_workspace_activity'
    | 'pne_list_projects'
    | 'pne_create_project'
    | 'pne_update_project'
    | 'pne_get_project_status'
    | 'pne_list_project_share_links'
    | 'pne_create_project_share_link'
    | 'pne_list_project_sources'
    | 'pne_add_project_source'
    | 'pne_delete_project_source'
    | 'pne_get_project_lineage'
    | 'pne_get_project_analytics'
    | 'pne_get_project_formulas'
    | 'pne_get_project_overrides'
    | 'pne_list_project_recommendations'
    | 'pne_train_project_recommendation'
    | 'pne_run_project_runtime'
    | 'pne_list_runtime_requests'
    | 'pne_get_runtime_request_status'
    | 'pne_get_runtime_request_artifacts'
    | 'pne_poll_runtime_request'
    | 'pne_check_project_updates'
    | 'pne_discover_project_sources'
    | 'pne_create_project_override'
    | 'pne_record_sentinel_feedback'
    | 'pne_get_dashboard_data'
    | 'pne_get_dashboard_manifest'
    | 'pne_get_dashboard_widget_data'
    | 'pne_reload_widget_registry'
    | 'pne_preview_workspace_invitation'
    | 'pne_accept_workspace_invitation'
    | 'pne_get_shared_project'
    | 'pne_list_sources'
    | 'pne_get_resource_snapshot'
    | 'pne_analyze_question';
  description: string;
}

export interface PNEHttpClientOptions {
  endpoint: string;
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
}

export class PNEHttpClient implements CodexPNEClient {
  constructor(private readonly options: PNEHttpClientOptions) {}

  public async analyze(request: CodexPNERequest): Promise<CodexPNEResponse> {
    const fetcher = this.options.fetchImpl || fetch;
    const response = await fetcher(this.options.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.options.headers || {})
      },
      body: JSON.stringify(request)
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.message || `PNE HTTP request failed with ${response.status}`);
    }

    return normalizePneResponse(request, payload);
  }
}

export class PNELocalRuntimeClient implements CodexPNEClient {
  constructor(private readonly runtime: PNERuntime) {}

  public async analyze(request: CodexPNERequest): Promise<CodexPNEResponse> {
    const result = await this.runtime.analyze(toIntent(request));
    return normalizePneResponse(request, result);
  }
}

export class CodexAdapter {
  constructor(
    private readonly client: CodexPNEClient,
    private readonly options: CodexAdapterOptions = {}
  ) {}

  public async ask(request: CodexPNERequest): Promise<CodexPNEResponse> {
    return this.client.analyze({
      ...request,
      mode: request.mode || this.options.defaultMode || 'answer'
    });
  }

  public formatMarkdown(response: CodexPNEResponse): string {
    const sections = [
      response.answer,
      this.formatSqlBlocks(response.sqlBlocks),
      this.formatCaveats(response.caveats),
      this.formatFollowUps(response.followUps),
      this.formatNextActions(response.nextActions || [])
    ].filter(Boolean);

    return sections.join('\n\n');
  }

  private formatSqlBlocks(sqlBlocks: CodexPNEResponse['sqlBlocks']): string {
    if (!sqlBlocks.length) {
      return '';
    }

    return sqlBlocks.map((block) => [
      `### ${block.title}`,
      block.purpose,
      '```sql',
      block.sql,
      '```'
    ].join('\n')).join('\n\n');
  }

  private formatCaveats(caveats: string[]): string {
    if (!caveats.length) {
      return '';
    }

    return [
      '### Caveats',
      ...caveats.map((caveat) => `- ${caveat}`)
    ].join('\n');
  }

  private formatFollowUps(followUps: string[]): string {
    if (!followUps.length) {
      return '';
    }

    return [
      '### Follow-ups',
      ...followUps.map((followUp) => `- ${followUp}`)
    ].join('\n');
  }

  private formatNextActions(nextActions: NonNullable<CodexPNEResponse['nextActions']>): string {
    if (!nextActions.length) {
      return '';
    }

    return [
      '### Next Actions',
      ...nextActions.map((action) => `- ${action.message}`)
    ].join('\n');
  }
}

export class AgentSurfaceAdapter {
  constructor(private readonly codexAdapter: CodexAdapter) {}

  public describeTools(): PNEToolSpec[] {
    return [
      {
        name: 'pne_get_capabilities',
        description: 'Describe what PNE can do in the current runtime, including connector status and hosted-vs-local behavior.'
      },
      {
        name: 'pne_get_setup_guide',
        description: 'Inspect connector setup recipes so the host agent can guide the user from zero to a working warehouse connection.'
      },
      {
        name: 'pne_get_session_state',
        description: 'Inspect the local adaptive session state used by deterministic playbooks.'
      },
      {
        name: 'pne_reset_session_state',
        description: 'Reset the local adaptive session state if the user wants to start fresh.'
      },
      {
        name: 'pne_get_first_run_playbook',
        description: 'Return a strict first-run onboarding playbook that walks from connector choice to first executed analysis.'
      },
      {
        name: 'pne_get_project_memory',
        description: 'Read project-scoped memory, recent questions and contract export history.'
      },
      {
        name: 'pne_update_project_memory',
        description: 'Persist project-scoped notes and memory updates for future agent runs.'
      },
      {
        name: 'pne_reset_project_memory',
        description: 'Reset project-scoped memory when the user wants a clean slate.'
      },
      {
        name: 'pne_get_recommended_next_steps',
        description: 'Ask deterministic playbooks for the next best tool calls based on setup, project and runtime state.'
      },
      {
        name: 'pne_plan_ml_model',
        description: 'Suggest plausible baseline ML tasks and model directions from the current schema.'
      },
      {
        name: 'pne_build_ml_experiment_contract',
        description: 'Turn an ML planning candidate into a detailed sandbox-ready experiment contract.'
      },
      {
        name: 'pne_export_contract',
        description: 'Export a widget, PowerBI or ML contract as a versioned JSON artifact.'
      },
      {
        name: 'pne_list_contract_versions',
        description: 'List previous contract exports for a project, optionally filtered by type.'
      },
      {
        name: 'pne_check_local_prerequisites',
        description: 'Check which local binaries and environment variables are available for connector setup.'
      },
      {
        name: 'pne_list_configured_connectors',
        description: 'List local connectors already configured in the PNE bridge.'
      },
      {
        name: 'pne_configure_connector',
        description: 'Create or update a local connector configuration through the bridge.'
      },
      {
        name: 'pne_test_connector',
        description: 'Test a connector by introspecting sources and creating a fresh snapshot.'
      },
      {
        name: 'pne_execute_sql',
        description: 'Execute explicit SQL through the active connector and return rows directly.'
      },
      {
        name: 'pne_get_widget_catalog',
        description: 'Expose the portable widget catalog for external BI or UI consumers.'
      },
      {
        name: 'pne_resolve_widget_contract',
        description: 'Resolve a widget type or inline contract into a normalized widget query contract.'
      },
      {
        name: 'pne_build_powerbi_query',
        description: 'Build a PowerBI-friendly query definition, including Power Query M, from a SQL statement and widget contract.'
      },
      {
        name: 'pne_build_powerbi_dataset',
        description: 'Build a PowerBI dataset definition from one or more PowerBI query definitions.'
      },
      {
        name: 'pne_get_account_snapshot',
        description: 'Inspect the authenticated hosted account snapshot and current workspace context.'
      },
      {
        name: 'pne_get_environment_status',
        description: 'Summarize whether the current environment has a warehouse, hosted workspaces, projects and already-analyzed artifacts.'
      },
      {
        name: 'pne_get_connector_catalog',
        description: 'List the hosted connector catalog and supported discovery modes.'
      },
      {
        name: 'pne_list_workspaces',
        description: 'List hosted workspaces when the bridge is connected to the StatsParrot control plane.'
      },
      {
        name: 'pne_create_workspace',
        description: 'Create a hosted workspace when the user needs a new control plane container.'
      },
      {
        name: 'pne_get_workspace_detail',
        description: 'Inspect the full detail object for a hosted workspace.'
      },
      {
        name: 'pne_get_workspace_members',
        description: 'Inspect members and access roles for a hosted workspace.'
      },
      {
        name: 'pne_get_workspace_invitations',
        description: 'Inspect pending invitations for a hosted workspace.'
      },
      {
        name: 'pne_create_workspace_invitation',
        description: 'Create a hosted workspace invitation.'
      },
      {
        name: 'pne_get_workspace_activity',
        description: 'Inspect recent activity and audit events for a hosted workspace.'
      },
      {
        name: 'pne_list_projects',
        description: 'List hosted projects in the current workspace so the agent can decide what to inspect next.'
      },
      {
        name: 'pne_create_project',
        description: 'Create a hosted project in the active workspace.'
      },
      {
        name: 'pne_update_project',
        description: 'Update a hosted project name, members or view link.'
      },
      {
        name: 'pne_get_project_status',
        description: 'Inspect whether a project already has sources, discovery metadata, projections, queries, formulas and runtime artifacts.'
      },
      {
        name: 'pne_list_project_share_links',
        description: 'Inspect share links already configured for a hosted project.'
      },
      {
        name: 'pne_create_project_share_link',
        description: 'Create a share link for a hosted project.'
      },
      {
        name: 'pne_list_project_sources',
        description: 'List sources already attached to a hosted project.'
      },
      {
        name: 'pne_add_project_source',
        description: 'Attach a new source to a hosted project.'
      },
      {
        name: 'pne_delete_project_source',
        description: 'Delete an attached source from a hosted project.'
      },
      {
        name: 'pne_get_project_lineage',
        description: 'Read discovery metadata and lineage for a hosted project.'
      },
      {
        name: 'pne_get_project_analytics',
        description: 'Read the hosted analytics payload for a project dashboard.'
      },
      {
        name: 'pne_get_project_formulas',
        description: 'Inspect formulas and generated code views for a hosted project.'
      },
      {
        name: 'pne_get_project_overrides',
        description: 'Inspect decision overrides for a hosted project.'
      },
      {
        name: 'pne_list_project_recommendations',
        description: 'List ML recommendations for a hosted project.'
      },
      {
        name: 'pne_train_project_recommendation',
        description: 'Trigger ML training for a hosted recommendation after approval.'
      },
      {
        name: 'pne_run_project_runtime',
        description: 'Trigger the hosted runtime for a project.'
      },
      {
        name: 'pne_list_runtime_requests',
        description: 'List hosted runtime request IDs for a project so the host agent can inspect or resume an in-flight run.'
      },
      {
        name: 'pne_get_runtime_request_status',
        description: 'Read the persisted status of a hosted runtime request, including progress stage, vitals and terminal state.'
      },
      {
        name: 'pne_get_runtime_request_artifacts',
        description: 'Read the persisted runtime artifacts for a hosted request, such as progress, projection plan, sentinel report and output manifest.'
      },
      {
        name: 'pne_poll_runtime_request',
        description: 'Return an agent-friendly polling summary for the latest or specified hosted runtime request.'
      },
      {
        name: 'pne_check_project_updates',
        description: 'Check whether hosted project sources changed since the last runtime.'
      },
      {
        name: 'pne_discover_project_sources',
        description: 'Discover hosted project sources from object storage configuration.'
      },
      {
        name: 'pne_create_project_override',
        description: 'Create a hosted decision override for a project artifact.'
      },
      {
        name: 'pne_record_sentinel_feedback',
        description: 'Record feedback on a Sentinel-reviewed artifact so policy memory can adapt.'
      },
      {
        name: 'pne_get_dashboard_data',
        description: 'Read the hosted dashboard payload for a project.'
      },
      {
        name: 'pne_get_dashboard_manifest',
        description: 'Read the hosted dashboard manifest for a project.'
      },
      {
        name: 'pne_get_dashboard_widget_data',
        description: 'Read a single hosted widget payload from a project dashboard.'
      },
      {
        name: 'pne_reload_widget_registry',
        description: 'Reload the hosted widget cache or registry.'
      },
      {
        name: 'pne_preview_workspace_invitation',
        description: 'Preview a public workspace invitation before accepting it.'
      },
      {
        name: 'pne_accept_workspace_invitation',
        description: 'Accept a public workspace invitation in hosted mode.'
      },
      {
        name: 'pne_get_shared_project',
        description: 'Resolve a public shared project and its dashboard payload.'
      },
      {
        name: 'pne_list_sources',
        description: 'List connected warehouse sources and their profiled capabilities before planning analysis.'
      },
      {
        name: 'pne_get_resource_snapshot',
        description: 'Return the cached resource snapshot and version for the active connector so host agents can track memory and source drift.'
      },
      {
        name: 'pne_analyze_question',
        description: 'Send a business question plus interpreted intent to PNE and receive SQL, evidence, caveats and next actions.'
      }
    ];
  }

  public toToolCallEnvelope(input: AgentSurfaceRequest): PNEToolCallEnvelope {
    return {
      toolName: 'pne_analyze_question',
      arguments: {
        ...input.request,
        hostContext: {
          surface: input.surface,
          ...(input.request.hostContext || {}),
          metadata: {
            ...(input.request.hostContext?.metadata || {}),
            ...(input.metadata || {})
          }
        }
      }
    };
  }

  public async handle(input: AgentSurfaceRequest): Promise<{
    surface: AgentSurface;
    response: CodexPNEResponse;
    markdown: string;
  }> {
    const response = await this.codexAdapter.ask(this.toToolCallEnvelope(input).arguments);
    return {
      surface: input.surface,
      response,
      markdown: this.codexAdapter.formatMarkdown(response)
    };
  }
}

export const createCodexAdapter = (client: CodexPNEClient, options: CodexAdapterOptions = {}) => (
  new CodexAdapter(client, options)
);

export const createAgentSurfaceAdapter = (client: CodexPNEClient, options: CodexAdapterOptions = {}) => (
  new AgentSurfaceAdapter(new CodexAdapter(client, options))
);

const toIntent = (request: CodexPNERequest): PNEAnalysisIntent => ({
  requestId: request.requestId,
  mode: request.mode || 'answer',
  question: request.question,
  conversation: request.conversation,
  sources: request.sources.map((source) => ({
    ...source,
    columns: source.columns.map((column) => ({
      ...column,
      semanticType: isKnownSemanticType(column.semanticType) ? column.semanticType : 'unknown'
    }))
  })),
  domain: request.domain,
  hostContext: request.hostContext,
  interpretedIntent: request.interpretedIntent
});

const normalizePneResponse = (request: CodexPNERequest, payload: any): CodexPNEResponse => {
  const sql = Array.isArray(payload?.sql)
    ? payload.sql
    : Array.isArray(payload?.plan?.plannedQueries)
      ? payload.plan.plannedQueries
      : [];

  return {
    requestId: payload?.requestId || request.requestId,
    answer: payload?.answer || 'PNE returned a response without a textual answer.',
    sqlBlocks: sql.map((query: any) => ({
      queryId: String(query.queryId || query.id || 'query'),
      title: String(query.title || query.queryId || 'Query'),
      sql: String(query.sql || ''),
      purpose: String(query.purpose || '')
    })),
    caveats: [
      ...(Array.isArray(payload?.plan?.missingInputs)
        ? payload.plan.missingInputs.map((item: any) => String(item.reason || item.metric || 'Missing input'))
        : []),
      ...(Array.isArray(payload?.caveats) ? payload.caveats.map((item: any) => String(item)) : [])
    ],
    followUps: Array.isArray(payload?.plan?.followUpQuestions)
      ? payload.plan.followUpQuestions.map((item: any) => String(item))
      : [],
    evidence: Array.isArray(payload?.evidence) ? payload.evidence : [],
    nextActions: Array.isArray(payload?.nextActions) ? payload.nextActions : [],
    agentPackage: payload?.agentPackage,
    raw: payload
  };
};

const isKnownSemanticType = (value: string | undefined): value is 'id' | 'timestamp' | 'metric' | 'dimension' | 'json' | 'unknown' => (
  value === 'id'
  || value === 'timestamp'
  || value === 'metric'
  || value === 'dimension'
  || value === 'json'
  || value === 'unknown'
);
