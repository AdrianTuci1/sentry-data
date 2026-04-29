"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAgentSurfaceAdapter = exports.createCodexAdapter = exports.AgentSurfaceAdapter = exports.CodexAdapter = exports.PNELocalRuntimeClient = exports.PNEHttpClient = void 0;
class PNEHttpClient {
    constructor(options) {
        this.options = options;
    }
    async analyze(request) {
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
exports.PNEHttpClient = PNEHttpClient;
class PNELocalRuntimeClient {
    constructor(runtime) {
        this.runtime = runtime;
    }
    async analyze(request) {
        const result = await this.runtime.analyze(toIntent(request));
        return normalizePneResponse(request, result);
    }
}
exports.PNELocalRuntimeClient = PNELocalRuntimeClient;
class CodexAdapter {
    constructor(client, options = {}) {
        this.client = client;
        this.options = options;
    }
    async ask(request) {
        return this.client.analyze({
            ...request,
            mode: request.mode || this.options.defaultMode || 'answer'
        });
    }
    formatMarkdown(response) {
        const sections = [
            response.answer,
            this.formatSqlBlocks(response.sqlBlocks),
            this.formatCaveats(response.caveats),
            this.formatFollowUps(response.followUps),
            this.formatNextActions(response.nextActions || [])
        ].filter(Boolean);
        return sections.join('\n\n');
    }
    formatSqlBlocks(sqlBlocks) {
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
    formatCaveats(caveats) {
        if (!caveats.length) {
            return '';
        }
        return [
            '### Caveats',
            ...caveats.map((caveat) => `- ${caveat}`)
        ].join('\n');
    }
    formatFollowUps(followUps) {
        if (!followUps.length) {
            return '';
        }
        return [
            '### Follow-ups',
            ...followUps.map((followUp) => `- ${followUp}`)
        ].join('\n');
    }
    formatNextActions(nextActions) {
        if (!nextActions.length) {
            return '';
        }
        return [
            '### Next Actions',
            ...nextActions.map((action) => `- ${action.message}`)
        ].join('\n');
    }
}
exports.CodexAdapter = CodexAdapter;
class AgentSurfaceAdapter {
    constructor(codexAdapter) {
        this.codexAdapter = codexAdapter;
    }
    describeTools() {
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
    toToolCallEnvelope(input) {
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
    async handle(input) {
        const response = await this.codexAdapter.ask(this.toToolCallEnvelope(input).arguments);
        return {
            surface: input.surface,
            response,
            markdown: this.codexAdapter.formatMarkdown(response)
        };
    }
}
exports.AgentSurfaceAdapter = AgentSurfaceAdapter;
const createCodexAdapter = (client, options = {}) => (new CodexAdapter(client, options));
exports.createCodexAdapter = createCodexAdapter;
const createAgentSurfaceAdapter = (client, options = {}) => (new AgentSurfaceAdapter(new CodexAdapter(client, options)));
exports.createAgentSurfaceAdapter = createAgentSurfaceAdapter;
const toIntent = (request) => ({
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
const normalizePneResponse = (request, payload) => {
    const sql = Array.isArray(payload?.sql)
        ? payload.sql
        : Array.isArray(payload?.plan?.plannedQueries)
            ? payload.plan.plannedQueries
            : [];
    return {
        requestId: payload?.requestId || request.requestId,
        answer: payload?.answer || 'PNE returned a response without a textual answer.',
        sqlBlocks: sql.map((query) => ({
            queryId: String(query.queryId || query.id || 'query'),
            title: String(query.title || query.queryId || 'Query'),
            sql: String(query.sql || ''),
            purpose: String(query.purpose || '')
        })),
        caveats: [
            ...(Array.isArray(payload?.plan?.missingInputs)
                ? payload.plan.missingInputs.map((item) => String(item.reason || item.metric || 'Missing input'))
                : []),
            ...(Array.isArray(payload?.caveats) ? payload.caveats.map((item) => String(item)) : [])
        ],
        followUps: Array.isArray(payload?.plan?.followUpQuestions)
            ? payload.plan.followUpQuestions.map((item) => String(item))
            : [],
        evidence: Array.isArray(payload?.evidence) ? payload.evidence : [],
        nextActions: Array.isArray(payload?.nextActions) ? payload.nextActions : [],
        agentPackage: payload?.agentPackage,
        raw: payload
    };
};
const isKnownSemanticType = (value) => (value === 'id'
    || value === 'timestamp'
    || value === 'metric'
    || value === 'dimension'
    || value === 'json'
    || value === 'unknown');
