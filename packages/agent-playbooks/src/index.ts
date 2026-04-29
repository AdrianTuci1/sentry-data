export interface AgentToolRecommendation {
  toolName: string;
  arguments?: Record<string, unknown>;
  reason: string;
}

export interface AgentSessionState {
  version: 1;
  lastUpdatedAt: string;
  lastPlaybookId?: string;
  lastConnectorId?: string;
  recentWorkspaceId?: string;
  recentProjectId?: string;
  lastRecommendedTool?: string;
  lastBlockingIssue?: string;
  notes?: string[];
  onboarding?: {
    playbookId: string;
    currentStepId?: string;
    completedStepIds: string[];
  };
}

export interface SetupGuideRecipe {
  connectorType: string;
  title: string;
  required: string[];
  optional?: string[];
  prerequisites?: string[];
  commands?: string[];
}

export interface SetupGuide {
  recommendedFlow: string[];
  recipes: SetupGuideRecipe[];
}

export interface LocalPrerequisites {
  binaries: Record<string, boolean>;
  env: Record<string, boolean>;
}

export interface ConfiguredConnectorSummary {
  connectorId: string;
  type: string;
  engine: string;
  isDefault: boolean;
}

export interface AgentPlaybookInput {
  question?: string;
  domain?: string;
  connectorId?: string;
  environmentStatus?: Record<string, unknown>;
  setupGuide?: SetupGuide;
  localPrerequisites?: LocalPrerequisites;
  configuredConnectors?: ConfiguredConnectorSummary[];
  projectStatus?: Record<string, unknown>;
  sessionState?: AgentSessionState;
}

export interface AgentPlaybookResult {
  status: 'ready' | 'needs_setup' | 'needs_runtime' | 'needs_project_selection' | 'needs_sources' | 'blocked';
  playbookId: string;
  explanation: string;
  blockingIssues: string[];
  recommendedToolCalls: AgentToolRecommendation[];
  userQuestions: string[];
  sessionState: AgentSessionState;
}

export interface FirstRunPlaybookStep {
  stepId: string;
  title: string;
  description: string;
  status: 'completed' | 'ready' | 'pending' | 'blocked' | 'optional';
  toolName?: string;
  reason?: string;
  blockingIssue?: string;
}

export interface FirstRunPlaybookResult {
  status: 'ready' | 'needs_setup' | 'blocked';
  playbookId: 'first_run_strict';
  currentStepId: string;
  explanation: string;
  userQuestions: string[];
  steps: FirstRunPlaybookStep[];
  sessionState: AgentSessionState;
}

export interface MlPlanningInput {
  question?: string;
  domain?: string;
  sources: Array<{
    sourceId: string;
    sourceName?: string;
    columns: Array<{
      name: string;
      semanticType?: string;
      type?: string;
    }>;
  }>;
}

export interface MlModelCandidate {
  candidateId: string;
  taskType: 'forecasting' | 'classification' | 'regression' | 'anomaly_detection' | 'clustering';
  sourceId: string;
  title: string;
  targetColumn?: string;
  featureColumns: string[];
  confidence: number;
  rationale: string;
  missingRequirements: string[];
}

export interface MlPlanningResult {
  status: 'ready' | 'insufficient_signal';
  explanation: string;
  candidates: MlModelCandidate[];
  blockingIssues: string[];
}

const nowIso = () => new Date().toISOString();

export const emptySessionState = (): AgentSessionState => ({
  version: 1,
  lastUpdatedAt: nowIso(),
  notes: [],
  onboarding: {
    playbookId: 'first_run_strict',
    completedStepIds: []
  }
});

export const buildFirstRunPlaybook = (input: AgentPlaybookInput): FirstRunPlaybookResult => {
  const session = {
    ...(input.sessionState || emptySessionState()),
    lastUpdatedAt: nowIso()
  };
  const connectors = input.configuredConnectors || [];
  const env = input.environmentStatus || {};
  const projectStatus = input.projectStatus || {};
  const prereqs = input.localPrerequisites;
  const hasConnector = Boolean(env.connectorConfigured) || connectors.length > 0;
  const activeConnector = connectors.find((connector) => connector.isDefault) || connectors[0];
  const hostedMode = hasHostedConnector(connectors);
  const hasProjectId = Boolean(projectStatus.projectId);
  const hasSources = Boolean(projectStatus.hasSources) || numberOrZero(projectStatus.sourceCount) > 0;
  const analyzed = Boolean(projectStatus.analyzed) || numberOrZero(projectStatus.queryCount) > 0 || numberOrZero(projectStatus.projectionCount) > 0;

  const steps: FirstRunPlaybookStep[] = [
    {
      stepId: 'choose_connector',
      title: 'Choose Connector',
      description: 'Choose between hosted PNE, BigQuery, Snowflake, Postgres, DuckDB local, or DuckDB over object storage.',
      status: hasConnector ? 'completed' : 'ready',
      toolName: 'pne_get_setup_guide',
      reason: 'Inspect the supported setup paths.'
    },
    {
      stepId: 'check_prerequisites',
      title: 'Check Prerequisites',
      description: 'Verify local CLIs, Python support and credentials before connector setup.',
      status: hasConnector ? 'completed' : prerequisitesReady(prereqs) ? 'ready' : 'blocked',
      toolName: 'pne_check_local_prerequisites',
      reason: 'Confirm the local runtime can support the chosen connector.',
      blockingIssue: prerequisitesReady(prereqs) ? undefined : 'local_prerequisites_missing'
    },
    {
      stepId: 'configure_connector',
      title: 'Configure Connector',
      description: 'Persist the connector configuration that PNE will use for introspection and query execution.',
      status: hasConnector ? 'completed' : 'pending',
      toolName: 'pne_configure_connector',
      reason: 'Create a reusable bridge configuration.'
    },
    {
      stepId: 'test_connector',
      title: 'Test Connector',
      description: 'Run source introspection and create the first resource snapshot.',
      status: hasConnector ? 'ready' : 'pending',
      toolName: 'pne_test_connector',
      reason: 'Validate the connector and populate source metadata.'
    },
    {
      stepId: 'inspect_sources',
      title: 'Inspect Sources',
      description: 'Read source schemas, timestamps and semantic candidates before asking questions.',
      status: hasConnector ? 'ready' : 'pending',
      toolName: 'pne_list_sources',
      reason: 'Inspect the available source inventory.'
    },
    {
      stepId: 'select_project_context',
      title: 'Select Project Context',
      description: 'In hosted mode, bind artifacts and memory to a specific workspace and project.',
      status: !hostedMode ? 'optional' : hasProjectId ? 'completed' : 'ready',
      toolName: 'pne_get_project_status',
      reason: 'Confirm which project should own memory and runtime artifacts.'
    },
    {
      stepId: 'run_runtime',
      title: 'Run Runtime',
      description: 'Generate projections and query specs when the hosted project has not been analyzed yet.',
      status: !hostedMode || !hasProjectId ? 'optional' : analyzed ? 'completed' : hasSources ? 'ready' : 'blocked',
      toolName: 'pne_run_project_runtime',
      reason: 'Create runtime artifacts before deeper project analysis.',
      blockingIssue: hostedMode && hasProjectId && !hasSources ? 'project_has_no_sources' : undefined
    },
    {
      stepId: 'analyze_first_question',
      title: 'Analyze First Question',
      description: 'Ask the first question and let PNE return SQL, evidence, caveats and next actions.',
      status: hasConnector && (!hostedMode || analyzed || !hasProjectId) ? 'ready' : 'pending',
      toolName: 'pne_analyze_question',
      reason: 'Move from setup into executed analysis.'
    }
  ];

  const currentStep = steps.find((step) => step.status === 'ready')
    || steps.find((step) => step.status === 'blocked')
    || steps[steps.length - 1];
  const completedStepIds = steps.filter((step) => step.status === 'completed').map((step) => step.stepId);

  return {
    status: currentStep.status === 'blocked'
      ? 'blocked'
      : hasConnector
        ? 'ready'
        : 'needs_setup',
    playbookId: 'first_run_strict',
    currentStepId: currentStep.stepId,
    explanation: explainFirstRunState(currentStep, activeConnector?.type),
    userQuestions: currentStep.stepId === 'choose_connector'
      ? ['Do you want to start with hosted PNE, BigQuery, Snowflake, Postgres, DuckDB local, or DuckDB over R2/S3?']
      : currentStep.stepId === 'select_project_context'
        ? ['Which project should own memory, contracts and runtime artifacts?']
        : [],
    steps,
    sessionState: {
      ...session,
      lastPlaybookId: 'first_run_strict',
      lastConnectorId: input.connectorId || activeConnector?.connectorId,
      lastRecommendedTool: currentStep.toolName,
      lastBlockingIssue: currentStep.blockingIssue,
      onboarding: {
        playbookId: 'first_run_strict',
        currentStepId: currentStep.stepId,
        completedStepIds
      }
    }
  };
};

export const recommendNextSteps = (input: AgentPlaybookInput): AgentPlaybookResult => {
  const session = {
    ...(input.sessionState || emptySessionState()),
    lastUpdatedAt: nowIso()
  };
  const connectors = input.configuredConnectors || [];
  const env = input.environmentStatus || {};
  const projectStatus = input.projectStatus || {};
  const setupGuide = input.setupGuide;
  const prereqs = input.localPrerequisites;
  const activeWorkspaceId = stringOrUndefined(env.activeWorkspaceId);
  const projectCount = numberOrZero(env.projectCount);
  const analyzedProjectCount = numberOrZero(env.analyzedProjectCount);
  const connectorConfigured = Boolean(env.connectorConfigured) || connectors.length > 0;
  const hasProjectId = Boolean(projectStatus.projectId);
  const hasSources = Boolean(projectStatus.hasSources) || numberOrZero(projectStatus.sourceCount) > 0;
  const analyzed = Boolean(projectStatus.analyzed) || numberOrZero(projectStatus.queryCount) > 0 || numberOrZero(projectStatus.projectionCount) > 0;

  if (!connectorConfigured) {
    const bestRecipe = chooseBestRecipe(setupGuide, prereqs);
    return finalize(session, {
      status: 'needs_setup',
      playbookId: 'bootstrap_no_connector',
      explanation: bestRecipe
        ? `No connector is configured yet. The best next path is ${bestRecipe.title}.`
        : 'No connector is configured yet. Start with setup guidance and local prerequisite checks.',
      blockingIssues: ['no_connector_configured'],
      recommendedToolCalls: [
        { toolName: 'pne_get_setup_guide', reason: 'Inspect available connector setup paths.' },
        { toolName: 'pne_check_local_prerequisites', reason: 'See which local binaries and credentials are available.' }
      ],
      userQuestions: bestRecipe ? [buildRecipeQuestion(bestRecipe)] : ['Do you want to connect hosted PNE, BigQuery, DuckDB on R2, Postgres, or Snowflake?']
    });
  }

  if (!activeWorkspaceId && hasHostedConnector(connectors)) {
    return finalize(session, {
      status: 'needs_project_selection',
      playbookId: 'hosted_workspace_navigation',
      explanation: 'A hosted connector exists, but the active workspace or project context is not selected yet.',
      blockingIssues: ['workspace_context_missing'],
      recommendedToolCalls: [
        { toolName: 'pne_get_account_snapshot', reason: 'Inspect the current hosted account and workspace snapshot.' },
        { toolName: 'pne_list_workspaces', reason: 'Choose the relevant workspace.' },
        { toolName: 'pne_list_projects', reason: 'Choose the relevant project in that workspace.' }
      ],
      userQuestions: ['Which hosted workspace or project should I inspect?']
    });
  }

  if (!hasProjectId && projectCount > 0 && analyzedProjectCount === 0) {
    return finalize(session, {
      status: 'needs_project_selection',
      playbookId: 'project_needs_runtime',
      explanation: 'Projects exist, but none appear to be analyzed yet.',
      blockingIssues: ['project_not_analyzed'],
      recommendedToolCalls: [
        { toolName: 'pne_list_projects', reason: 'Find the project to inspect.' },
        { toolName: 'pne_get_project_status', reason: 'Inspect whether the chosen project has sources and runtime artifacts.' }
      ],
      userQuestions: ['Which project should I analyze first?']
    });
  }

  if (hasProjectId && !hasSources) {
    return finalize(session, {
      status: 'needs_sources',
      playbookId: 'project_missing_sources',
      explanation: 'The selected project does not have usable sources attached yet.',
      blockingIssues: ['project_has_no_sources'],
      recommendedToolCalls: [
        { toolName: 'pne_get_connector_catalog', reason: 'Inspect which source connection strategies exist.' },
        { toolName: 'pne_list_project_sources', reason: 'Double-check whether any source is already attached.' },
        { toolName: 'pne_discover_project_sources', reason: 'Discover candidate sources from object storage when applicable.' }
      ],
      userQuestions: ['Do you want to attach a warehouse source now or discover sources from object storage?']
    });
  }

  if (hasProjectId && hasSources && !analyzed) {
    return finalize(session, {
      status: 'needs_runtime',
      playbookId: 'project_needs_runtime',
      explanation: 'The project has sources, but it still needs discovery/runtime execution before deeper analytics guidance.',
      blockingIssues: ['runtime_not_executed'],
      recommendedToolCalls: [
        { toolName: 'pne_get_project_status', reason: 'Confirm current artifact counts and runtime state.' },
        { toolName: 'pne_run_project_runtime', reason: 'Generate discovery metadata, projections and query specs.' }
      ],
      userQuestions: ['Do you want me to trigger the project runtime now?']
    });
  }

  return finalize(session, {
    status: 'ready',
    playbookId: 'analysis_readiness',
    explanation: 'The environment appears ready for source inspection and analysis.',
    blockingIssues: [],
    recommendedToolCalls: [
      { toolName: 'pne_list_sources', reason: 'Inspect available sources and semantic capabilities.' },
      { toolName: 'pne_get_resource_snapshot', reason: 'Inspect the latest cached schema snapshot before analysis.' },
      { toolName: 'pne_analyze_question', reason: 'Move from setup/navigation into actual analysis.' }
    ],
    userQuestions: []
  });
};

export const planMlModels = (input: MlPlanningInput): MlPlanningResult => {
  const candidates: MlModelCandidate[] = [];

  for (const source of input.sources) {
    const normalizedColumns = source.columns.map((column) => ({
      name: column.name,
      lower: column.name.toLowerCase(),
      semanticType: column.semanticType || 'unknown',
      type: (column.type || '').toLowerCase()
    }));
    const metrics = normalizedColumns.filter((column) => column.semanticType === 'metric');
    const timestamps = normalizedColumns.filter((column) => column.semanticType === 'timestamp');
    const ids = normalizedColumns.filter((column) => column.semanticType === 'id');
    const dimensions = normalizedColumns.filter((column) => column.semanticType === 'dimension');

    if (metrics.length > 0 && timestamps.length > 0) {
      candidates.push({
        candidateId: `${source.sourceId}-forecasting`,
        taskType: 'forecasting',
        sourceId: source.sourceId,
        title: `Forecast ${metrics[0].name} over time`,
        targetColumn: metrics[0].name,
        featureColumns: [timestamps[0].name],
        confidence: 0.78,
        rationale: 'A numeric metric plus a timestamp makes time-series forecasting plausible.',
        missingRequirements: []
      });
    }

    if (metrics.length > 0 && ids.length > 0 && dimensions.length > 0) {
      candidates.push({
        candidateId: `${source.sourceId}-regression`,
        taskType: 'regression',
        sourceId: source.sourceId,
        title: `Predict ${metrics[0].name}`,
        targetColumn: metrics[0].name,
        featureColumns: [...dimensions.slice(0, 3).map((column) => column.name), ids[0].name].slice(0, 4),
        confidence: 0.66,
        rationale: 'A numeric target plus entity and categorical features can support a regression baseline.',
        missingRequirements: []
      });
    }

    const statusLike = normalizedColumns.find((column) => /status|label|class|target|flag|is_/.test(column.lower));
    if (statusLike && (dimensions.length > 0 || metrics.length > 0)) {
      candidates.push({
        candidateId: `${source.sourceId}-classification`,
        taskType: 'classification',
        sourceId: source.sourceId,
        title: `Classify ${statusLike.name}`,
        targetColumn: statusLike.name,
        featureColumns: [...dimensions.slice(0, 2).map((column) => column.name), ...metrics.slice(0, 2).map((column) => column.name)],
        confidence: 0.64,
        rationale: 'A label-like column plus feature candidates can support a classification baseline.',
        missingRequirements: []
      });
    }

    if (metrics.length >= 2) {
      candidates.push({
        candidateId: `${source.sourceId}-anomaly`,
        taskType: 'anomaly_detection',
        sourceId: source.sourceId,
        title: `Detect anomalies in ${source.sourceName || source.sourceId}`,
        featureColumns: metrics.slice(0, 4).map((column) => column.name),
        confidence: 0.58,
        rationale: 'Multiple numeric metrics can support unsupervised anomaly detection.',
        missingRequirements: timestamps.length === 0 ? ['timestamp_for_incident_timeline'] : []
      });
    }
  }

  const ranked = rankMlCandidates(candidates, input.domain, input.question);
  if (ranked.length === 0) {
    return {
      status: 'insufficient_signal',
      explanation: 'I could not find a credible ML planning baseline from the available schema.',
      candidates: [],
      blockingIssues: ['no_ml_ready_feature_target_pattern']
    };
  }

  return {
    status: 'ready',
    explanation: 'I found a few plausible ML planning candidates grounded in the available schema.',
    candidates: ranked.slice(0, 5),
    blockingIssues: []
  };
};

const finalize = (
  session: AgentSessionState,
  result: Omit<AgentPlaybookResult, 'sessionState'>
): AgentPlaybookResult => ({
  ...result,
  sessionState: {
    ...session,
    lastPlaybookId: result.playbookId,
    lastRecommendedTool: result.recommendedToolCalls[0]?.toolName,
    lastBlockingIssue: result.blockingIssues[0]
  }
});

const chooseBestRecipe = (setupGuide?: SetupGuide, prereqs?: LocalPrerequisites): SetupGuideRecipe | undefined => {
  if (!setupGuide?.recipes?.length) {
    return undefined;
  }
  const binaries = prereqs?.binaries || {};
  if (binaries.bq) return setupGuide.recipes.find((recipe) => recipe.connectorType === 'bigquery');
  if ((binaries.python3 || binaries.duckdb) && (prereqs?.env.R2_ENDPOINT || prereqs?.env.R2_ACCESS_KEY_ID)) {
    return setupGuide.recipes.find((recipe) => recipe.connectorType === 'duckdb-r2');
  }
  if (binaries.duckdb) return setupGuide.recipes.find((recipe) => recipe.connectorType === 'duckdb');
  if (binaries.snowsql) return setupGuide.recipes.find((recipe) => recipe.connectorType === 'snowflake');
  if (binaries.psql) return setupGuide.recipes.find((recipe) => recipe.connectorType === 'postgres');
  return setupGuide.recipes.find((recipe) => recipe.connectorType === 'hosted') || setupGuide.recipes[0];
};

const prerequisitesReady = (prereqs?: LocalPrerequisites): boolean => {
  if (!prereqs) {
    return true;
  }
  return Object.values(prereqs.binaries || {}).some(Boolean) || Object.values(prereqs.env || {}).some(Boolean);
};

const hasHostedConnector = (connectors: ConfiguredConnectorSummary[]): boolean => (
  connectors.some((connector) => connector.type === 'hosted')
);

const explainFirstRunState = (step: FirstRunPlaybookStep, connectorType?: string): string => {
  if (step.stepId === 'choose_connector') {
    return 'PNE is waiting for the first connector choice before it can inspect any data.';
  }
  if (step.stepId === 'check_prerequisites') {
    return 'The next safe step is to verify local prerequisites before configuring a connector.';
  }
  if (step.stepId === 'configure_connector') {
    return 'The environment is ready to persist a connector configuration and continue onboarding.';
  }
  if (step.stepId === 'test_connector') {
    return `A ${connectorType || 'configured'} connector exists. The next step is to validate introspection and create a fresh snapshot.`;
  }
  if (step.stepId === 'select_project_context') {
    return 'Hosted mode needs an explicit project context so memory and runtime artifacts attach to the right project.';
  }
  if (step.stepId === 'run_runtime') {
    return 'The project has sources, but it still needs a runtime pass before deeper guidance is reliable.';
  }
  if (step.stepId === 'analyze_first_question') {
    return 'The environment is ready for the first executed question.';
  }
  return step.description;
};

const buildRecipeQuestion = (recipe: SetupGuideRecipe): string => (
  `Do you want to follow the ${recipe.title} setup path?`
);

const numberOrZero = (value: unknown): number => (
  typeof value === 'number' && Number.isFinite(value) ? value : 0
);

const stringOrUndefined = (value: unknown): string | undefined => (
  typeof value === 'string' && value.trim() ? value : undefined
);

const rankMlCandidates = (
  candidates: MlModelCandidate[],
  domain?: string,
  question?: string
): MlModelCandidate[] => {
  const normalizedQuestion = (question || '').toLowerCase();
  const domainBias = (candidate: MlModelCandidate) => {
    if (domain === 'ecommerce' && candidate.taskType === 'forecasting') return 0.08;
    if (domain === 'cybersecurity' && candidate.taskType === 'anomaly_detection') return 0.12;
    return 0;
  };
  const questionBias = (candidate: MlModelCandidate) => {
    if (normalizedQuestion.includes('forecast') && candidate.taskType === 'forecasting') return 0.1;
    if (normalizedQuestion.includes('anomaly') && candidate.taskType === 'anomaly_detection') return 0.1;
    if (normalizedQuestion.includes('predict') && ['classification', 'regression'].includes(candidate.taskType)) return 0.08;
    return 0;
  };

  return [...candidates]
    .map((candidate) => ({
      ...candidate,
      confidence: Number(Math.min(0.95, candidate.confidence + domainBias(candidate) + questionBias(candidate)).toFixed(2))
    }))
    .sort((left, right) => right.confidence - left.confidence);
};
