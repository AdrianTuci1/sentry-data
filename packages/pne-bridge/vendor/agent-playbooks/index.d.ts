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
export declare const emptySessionState: () => AgentSessionState;
export declare const buildFirstRunPlaybook: (input: AgentPlaybookInput) => FirstRunPlaybookResult;
export declare const recommendNextSteps: (input: AgentPlaybookInput) => AgentPlaybookResult;
export declare const planMlModels: (input: MlPlanningInput) => MlPlanningResult;
