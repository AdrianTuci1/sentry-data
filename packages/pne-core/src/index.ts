import {
  WarehouseConnector,
  WarehouseQueryResult,
  WarehouseTableProfile
} from '@statsparrot/connector-sdk';
import {
  createObservationRecorder,
  ObservationRecorder,
  ObservationSink
} from '@statsparrot/observability';
import {
  SentinelArtifact,
  SentinelCore,
  SentinelReviewResult,
  createSentinelCore
} from '@statsparrot/sentinel-core';

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

export class CapabilityAwarePlanner implements PNEPlanner {
  public async plan(intent: PNEAnalysisIntent): Promise<PNEAnalysisPlan> {
    const requestedMetrics = this.detectRequestedMetrics(intent.question);
    const interpretedMetrics = intent.interpretedIntent?.metrics || [];
    const uniqueMetrics = [...new Set([...requestedMetrics, ...interpretedMetrics])];
    const missingInputs = uniqueMetrics.flatMap((metric) => this.findMissingInputs(metric, intent.sources));
    const joinQueries = this.planJoinQueries(intent);
    const sourceQueries = intent.sources.flatMap((source) => this.planSourceQueries(intent, source));
    const supportingQueries = joinQueries.length > 0
      ? sourceQueries.filter((query) => query.expectedShape === 'timeseries').slice(0, 1)
      : sourceQueries;
    const plannedQueries = [
      ...joinQueries,
      ...supportingQueries
    ].slice(0, intent.constraints?.maxQueries || 6);

    return {
      requestId: intent.requestId,
      mode: intent.mode,
      question: intent.question,
      plannedQueries,
      missingInputs,
      followUpQuestions: this.buildFollowUps(missingInputs, intent.interpretedIntent)
    };
  }

  public async answer(intent: PNEAnalysisIntent): Promise<PNEAnalysisResult> {
    const plan = await this.plan(intent);
    const caveats = plan.missingInputs.map((missing) => `${missing.metric}: ${missing.reason}`);

    return {
      requestId: intent.requestId,
      answer: plan.plannedQueries.length > 0
        ? 'I prepared the first validated analysis plan. Execute the planned SQL through a connector to produce evidence-backed insights.'
        : 'I could not prepare a useful analysis plan from the available warehouse metadata.',
      plan,
      insights: [],
      evidence: [],
      sql: plan.plannedQueries,
      observability: {
        missingInputCount: plan.missingInputs.length,
        plannedQueryCount: plan.plannedQueries.length,
        caveats
      }
    };
  }

  private detectRequestedMetrics(question: string): string[] {
    const normalized = question.toLowerCase();
    return [
      normalized.includes('ltv') ? 'ltv' : undefined,
      normalized.includes('roas') ? 'roas' : undefined,
      normalized.includes('cac') ? 'cac' : undefined
    ].filter((value): value is string => Boolean(value));
  }

  private findMissingInputs(metric: string, sources: PNEWarehouseSource[]) {
    const allColumns = new Set(sources.flatMap((source) => source.columns.map((column) => column.name.toLowerCase())));
    const requirements: Record<string, string[]> = {
      ltv: ['customer_id', 'revenue', 'order_purchase_timestamp'],
      roas: ['spend', 'revenue'],
      cac: ['spend', 'customer_id']
    };
    const requiredColumns = requirements[metric] || [];
    const missingColumns = requiredColumns.filter((column) => !allColumns.has(column));

    if (missingColumns.length === 0) {
      return [];
    }

    return [{
      metric,
      reason: `Cannot compute ${metric.toUpperCase()} without ${missingColumns.join(', ')}.`,
      requiredColumns: missingColumns
    }];
  }

  private planSourceQueries(intent: PNEAnalysisIntent, source: PNEWarehouseSource): PNEPlannedQuery[] {
    const sourceId = source.sourceId || source.tableId || 'source';
    const sourceName = source.sourceName || source.tableId || sourceId;
    const timestamp = source.timestampCandidates?.[0];
    const metric = this.pickMetric(source, intent);
    const entity = this.pickDimension(source, intent);
    const table = source.tableId || source.uri || sourceId;
    const queries: PNEPlannedQuery[] = [];

    if (timestamp && metric) {
      queries.push({
        queryId: `${sourceId}_metric_trend`,
        title: `${sourceName} ${metric} trend`,
        sourceId,
        sql: `SELECT DATE_TRUNC(${timestamp}, DAY) AS period, AVG(${metric}) AS value FROM ${table} GROUP BY period ORDER BY period`,
        purpose: 'Show movement over time for the strongest available metric.',
        expectedShape: 'timeseries',
        dependencies: { columns: [timestamp, metric] },
        confidence: 0.72
      });
    }

    if (entity && metric) {
      queries.push({
        queryId: `${sourceId}_ranked_breakdown`,
        title: `${sourceName} ranked ${entity} breakdown`,
        sourceId,
        sql: `SELECT ${entity} AS label, AVG(${metric}) AS value FROM ${table} GROUP BY ${entity} ORDER BY value DESC LIMIT 10`,
        purpose: 'Find the entities that explain most of the movement in the selected metric.',
        expectedShape: 'categorical_breakdown',
        dependencies: { columns: [entity, metric] },
        confidence: 0.7
      });
    }

    return queries;
  }

  private planJoinQueries(intent: PNEAnalysisIntent): PNEPlannedQuery[] {
    const normalizedQuestion = intent.question.toLowerCase();
    const queries: PNEPlannedQuery[] = [];

    for (let leftIndex = 0; leftIndex < intent.sources.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < intent.sources.length; rightIndex += 1) {
        const left = intent.sources[leftIndex];
        const right = intent.sources[rightIndex];
        const sharedKey = this.pickSharedJoinKey(left, right);
        if (!sharedKey) {
          continue;
        }

        const leftMetric = this.pickMetric(left, intent);
        const rightMetric = this.pickMetric(right, intent);
        const metricSource = leftMetric ? left : rightMetric ? right : undefined;
        const metric = leftMetric || rightMetric;
        const dimensionSource = metricSource === left ? right : left;
        const metricTable = metricSource?.tableId || metricSource?.sourceId;
        const dimensionTable = dimensionSource?.tableId || dimensionSource?.sourceId;

        if (!metric || !metricSource || !metricTable || !dimensionTable) {
          continue;
        }

        const joinId = `${left.sourceId || left.tableId}__${right.sourceId || right.tableId}`;
        const metricSourceName = metricSource.sourceName || metricSource.tableId || metricSource.sourceId || 'Joined metric';

        if (normalizedQuestion.includes('status') && this.hasColumn(dimensionSource, 'order_status')) {
          queries.push({
            queryId: `${joinId}_status_metric_breakdown`,
            title: `${metricSourceName} by order status`,
            sourceId: joinId,
            sql: `SELECT d.order_status AS label, AVG(m.${metric}) AS value
FROM ${metricTable} AS m
JOIN ${dimensionTable} AS d ON m.${sharedKey} = d.${sharedKey}
GROUP BY d.order_status
ORDER BY value DESC`,
            purpose: 'Explain how the selected metric changes across order statuses using a shared business key.',
            expectedShape: 'categorical_breakdown',
            dependencies: { columns: [sharedKey, metric, 'order_status'] },
            confidence: 0.82
          });
        }

        if ((normalizedQuestion.includes('late') || normalizedQuestion.includes('delivery'))
          && this.hasColumn(dimensionSource, 'order_delivered_customer_date')
          && this.hasColumn(dimensionSource, 'order_estimated_delivery_date')) {
          queries.push({
            queryId: `${joinId}_delivery_metric_breakdown`,
            title: `${metricSourceName} by delivery outcome`,
            sourceId: joinId,
            sql: `SELECT
  CASE
    WHEN d.order_delivered_customer_date > d.order_estimated_delivery_date THEN 'late'
    ELSE 'on_time_or_early'
  END AS label,
  AVG(m.${metric}) AS value
FROM ${metricTable} AS m
JOIN ${dimensionTable} AS d ON m.${sharedKey} = d.${sharedKey}
GROUP BY 1
ORDER BY value DESC`,
            purpose: 'Compare the selected metric across late versus on-time deliveries.',
            expectedShape: 'categorical_breakdown',
            dependencies: {
              columns: [sharedKey, metric, 'order_delivered_customer_date', 'order_estimated_delivery_date']
            },
            confidence: 0.84
          });
        }

        if ((normalizedQuestion.includes('over time') || normalizedQuestion.includes('trend'))
          && this.hasColumn(dimensionSource, 'order_purchase_timestamp')) {
          queries.push({
            queryId: `${joinId}_joined_metric_trend`,
            title: `${metricSourceName} joined trend`,
            sourceId: joinId,
            sql: `SELECT DATE_TRUNC(d.order_purchase_timestamp, DAY) AS period, AVG(m.${metric}) AS value
FROM ${metricTable} AS m
JOIN ${dimensionTable} AS d ON m.${sharedKey} = d.${sharedKey}
GROUP BY period
ORDER BY period`,
            purpose: 'Show the selected metric over time using the purchasing timeline from the joined table.',
            expectedShape: 'timeseries',
            dependencies: { columns: [sharedKey, metric, 'order_purchase_timestamp'] },
            confidence: 0.78
          });
        }
      }
    }

    return queries;
  }

  private pickMetric(source: PNEWarehouseSource, intent: PNEAnalysisIntent): string | undefined {
    const desiredMetrics = new Set((intent.interpretedIntent?.metrics || []).map((item) => item.toLowerCase()));
    return source.metricCandidates?.find((candidate) => desiredMetrics.has(candidate.toLowerCase()))
      || source.metricCandidates?.[0];
  }

  private pickDimension(source: PNEWarehouseSource, intent: PNEAnalysisIntent): string | undefined {
    const desiredDimensions = new Set((intent.interpretedIntent?.dimensions || []).map((item) => item.toLowerCase()));
    return source.entityKeyCandidates?.find((candidate) => desiredDimensions.has(candidate.toLowerCase()))
      || source.entityKeyCandidates?.[0];
  }

  private pickSharedJoinKey(left: PNEWarehouseSource, right: PNEWarehouseSource): string | undefined {
    const leftKeys = new Set(left.entityKeyCandidates || []);
    return (right.entityKeyCandidates || []).find((candidate) => leftKeys.has(candidate));
  }

  private hasColumn(source: PNEWarehouseSource, columnName: string): boolean {
    return source.columns.some((column) => column.name === columnName);
  }

  private buildFollowUps(
    missingInputs: Array<{ metric: string; requiredColumns: string[] }>,
    interpretedIntent?: PNEInterpretedIntent
  ): string[] {
    return [...new Set([
      ...missingInputs.map((missing) => (
      `Which table contains ${missing.requiredColumns.join(', ')} for ${missing.metric.toUpperCase()}?`
      )),
      ...(interpretedIntent?.unresolvedQuestions || [])
    ])];
  }
}

export const createPNEPlanner = () => new CapabilityAwarePlanner();

export class PNERuntime {
  private readonly planner = new CapabilityAwarePlanner();
  private readonly sentinel: SentinelCore;

  constructor(private readonly options: PNERuntimeOptions) {
    this.sentinel = options.sentinel || createSentinelCore();
  }

  public async analyze(input: Omit<PNEAnalysisIntent, 'sources'> & { sources?: PNEWarehouseSource[] }): Promise<PNEAnalysisResult> {
    const recorder = createObservationRecorder(
      input.requestId,
      this.options.observationSinks || [],
      'pne_runtime_analyze'
    );
    recorder.checkpoint('request_received', 'started', 'PNE runtime request received.', {
      mode: input.mode,
      question: input.question
    });

    const sources = input.sources?.length
      ? input.sources
      : await this.loadSources(recorder);
    const intent: PNEAnalysisIntent = {
      ...input,
      sources
    };

    const plan = await this.planner.plan(intent);
    recorder.checkpoint('planning', 'ok', `Planned ${plan.plannedQueries.length} query candidate(s).`, {
      missingInputCount: plan.missingInputs.length
    });

    const sentinel = this.reviewPlan(plan, sources);
    recorder.checkpoint('sentinel_review', sentinel.hints.length > 0 ? 'warn' : 'ok', 'Sentinel reviewed planned queries.', {
      signalCount: sentinel.signals.length,
      hintCount: sentinel.hints.length
    });

    const executions = this.options.executeQueries === false
      ? []
      : await this.executePlan(plan, recorder);
    const evidence = executions.map((execution) => this.toEvidence(execution));
    const insights = this.toInsights(plan, evidence);
    const answer = this.composeAnswer(plan, evidence, sentinel);
    const nextActions = this.buildNextActions(intent, plan, evidence);
    const trace = recorder.summarize({
      plannedQueryCount: plan.plannedQueries.length,
      executedQueryCount: executions.length,
      sentinelHintCount: sentinel.hints.length,
      missingInputCount: plan.missingInputs.length
    });

    return {
      requestId: intent.requestId,
      answer,
      plan,
      insights,
      evidence,
      sql: plan.plannedQueries,
      nextActions,
      agentPackage: {
        status: !sources.length
          ? 'needs_connection'
          : plan.followUpQuestions.length > 0
            ? 'needs_clarification'
            : 'ready',
        hostSurface: intent.hostContext?.surface,
        nextActions
      },
      sentinel,
      observability: trace as unknown as Record<string, unknown>
    };
  }

  private async loadSources(recorder: ObservationRecorder): Promise<PNEWarehouseSource[]> {
    const profiles = await this.options.connector.introspect();
    recorder.checkpoint('connector_introspection', 'ok', `Connector returned ${profiles.length} table profile(s).`, {
      engine: this.options.connector.engine
    });

    return profiles.map((profile) => this.fromTableProfile(profile));
  }

  private fromTableProfile(profile: WarehouseTableProfile): PNEWarehouseSource {
    return {
      sourceId: profile.tableId,
      sourceName: profile.displayName || profile.tableId,
      engine: profile.engine,
      tableId: profile.tableId,
      domain: typeof profile.metadata?.domain === 'string' ? profile.metadata.domain : undefined,
      columns: profile.columns,
      metricCandidates: profile.metricCandidates,
      entityKeyCandidates: profile.entityKeyCandidates,
      timestampCandidates: profile.timestampCandidates,
      sampleRows: profile.sampleRows,
      metadata: profile.metadata
    };
  }

  private reviewPlan(plan: PNEAnalysisPlan, sources: PNEWarehouseSource[]): SentinelReviewResult {
    const sourceById = new Map(sources.map((source) => [source.sourceId, source]));
    const artifacts: SentinelArtifact[] = plan.plannedQueries.map((query) => {
      const source = sourceById.get(query.sourceId);
      return {
        artifactId: query.queryId,
        artifactType: 'query',
        title: query.title,
        sourceId: query.sourceId,
        domain: source?.domain,
        text: query.purpose,
        sql: query.sql,
        columns: query.dependencies.columns,
        metrics: source?.metricCandidates || [],
        metadata: {
          expectedShape: query.expectedShape
        }
      };
    });

    return this.sentinel.review(artifacts);
  }

  private async executePlan(plan: PNEAnalysisPlan, recorder: ObservationRecorder): Promise<PNERuntimeExecution[]> {
    const executions: PNERuntimeExecution[] = [];

    for (const query of plan.plannedQueries) {
      const dryRun = await this.options.connector.dryRun({
        requestId: `${plan.requestId}-${query.queryId}-dry-run`,
        sql: query.sql
      });
      if (dryRun.warnings?.length) {
        recorder.checkpoint('query_dry_run', 'warn', `Dry run warning for ${query.queryId}.`, {
          warnings: dryRun.warnings
        });
      }

      const result = await this.options.connector.execute({
        requestId: `${plan.requestId}-${query.queryId}`,
        sql: query.sql,
        maxRows: 50
      });
      recorder.checkpoint('query_execution', result.error ? 'fail' : 'ok', `Executed ${query.queryId}.`, {
        rowCount: result.rowCount,
        error: result.error
      });
      executions.push({ query, result });
    }

    return executions;
  }

  private toEvidence(execution: PNERuntimeExecution): PNEEvidenceItem {
    return {
      queryId: execution.query.queryId,
      title: execution.query.title,
      summary: execution.result.error
        ? `Query failed: ${execution.result.error.message}`
        : `Query returned ${execution.result.rowCount} row(s).`,
      rowCount: execution.result.rowCount,
      preview: execution.result.rows.slice(0, 5)
    };
  }

  private toInsights(plan: PNEAnalysisPlan, evidence: PNEEvidenceItem[]): PNEInsight[] {
    return evidence
      .filter((item) => item.rowCount && item.rowCount > 0)
      .map((item) => ({
        insightId: `insight-${item.queryId}`,
        title: item.title,
        answer: item.summary,
        sourceIds: plan.plannedQueries
          .filter((query) => query.queryId === item.queryId)
          .map((query) => query.sourceId),
        queryIds: [item.queryId],
        confidence: 0.65,
        caveats: []
      }));
  }

  private composeAnswer(plan: PNEAnalysisPlan, evidence: PNEEvidenceItem[], sentinel: SentinelReviewResult): string {
    if (plan.missingInputs.length > 0 && plan.plannedQueries.length === 0) {
      return `I cannot answer this reliably yet. ${plan.missingInputs.map((item) => item.reason).join(' ')}`;
    }

    const executed = evidence.length > 0
      ? `I executed ${evidence.length} query candidate(s).`
      : `I planned ${plan.plannedQueries.length} query candidate(s).`;
    const caveats = plan.missingInputs.length > 0
      ? ` Caveats: ${plan.missingInputs.map((item) => item.reason).join(' ')}`
      : '';
    const review = sentinel.hints.length > 0
      ? ` Sentinel raised ${sentinel.hints.length} review hint(s).`
      : '';

    return `${executed}${caveats}${review}`.trim();
  }

  private buildNextActions(intent: PNEAnalysisIntent, plan: PNEAnalysisPlan, evidence: PNEEvidenceItem[]): PNENextAction[] {
    const actions: PNENextAction[] = [];

    if (!intent.sources.length) {
      actions.push({
        type: 'connect_warehouse',
        message: 'Connect a warehouse source or provide profiled sources before asking PNE to analyze business questions.'
      });
    }

    actions.push(...plan.followUpQuestions.map((question) => ({
      type: 'ask_user' as const,
      message: question
    })));

    if (plan.plannedQueries.length > 0 && evidence.length === 0) {
      actions.push({
        type: 'run_queries',
        message: 'Execute the planned SQL through the connected query engine to collect evidence-backed results.',
        payload: {
          queryCount: plan.plannedQueries.length
        }
      });
    }

    if (intent.mode === 'dashboard') {
      actions.push({
        type: 'switch_to_hosted',
        message: 'Widget planning and dashboard composition live in the hosted layer on top of the universal analysis runtime.'
      });
    }

    return actions;
  }
}

export const createPNERuntime = (options: PNERuntimeOptions) => new PNERuntime(options);
