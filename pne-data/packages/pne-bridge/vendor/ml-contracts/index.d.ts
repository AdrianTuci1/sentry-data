export type MlTaskType = 'forecasting' | 'classification' | 'regression' | 'anomaly_detection' | 'clustering';
export interface MlPlanningCandidateInput {
    candidateId: string;
    taskType: MlTaskType;
    title: string;
    sourceId: string;
    targetColumn?: string;
    featureColumns?: string[];
    confidence?: number;
    rationale?: string;
    missingRequirements?: string[];
}
export interface MlSourceProfile {
    sourceId: string;
    sourceName?: string;
    columns: Array<{
        name: string;
        semanticType?: string;
        type?: string;
    }>;
}
export interface MlExperimentContract {
    version: 1;
    experimentId: string;
    title: string;
    taskType: MlTaskType;
    sourceId: string;
    sourceName?: string;
    targetColumn?: string;
    featureColumns: string[];
    excludedColumns: string[];
    splitStrategy: {
        type: 'time' | 'random' | 'grouped';
        entityKeyColumn?: string;
        timeColumn?: string;
        trainFraction: number;
        validationFraction: number;
        testFraction: number;
    };
    evaluation: {
        primaryMetric: string;
        secondaryMetrics: string[];
        baseline: string;
    };
    runtime: {
        executor: 'modal' | 'external';
        sandboxProfile: string;
        timeoutMinutes: number;
    };
    guardrails: {
        minRowCount: number;
        leakageChecks: string[];
        missingRequirements: string[];
    };
    expectedArtifacts: string[];
    rationale?: string;
    confidence: number;
}
export declare const buildMlExperimentContract: (candidate: MlPlanningCandidateInput, sources?: MlSourceProfile[]) => MlExperimentContract;
