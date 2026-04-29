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

const detectTimeColumn = (source?: MlSourceProfile): string | undefined => (
  source?.columns.find((column) => column.semanticType === 'timestamp')?.name
);

const detectEntityKey = (source?: MlSourceProfile): string | undefined => (
  source?.columns.find((column) => column.semanticType === 'id')?.name
);

const defaultEvaluation = (taskType: MlTaskType) => {
  switch (taskType) {
    case 'forecasting':
      return { primaryMetric: 'mae', secondaryMetrics: ['rmse', 'mape'], baseline: 'seasonal_naive' };
    case 'classification':
      return { primaryMetric: 'f1', secondaryMetrics: ['precision', 'recall', 'roc_auc'], baseline: 'majority_class' };
    case 'regression':
      return { primaryMetric: 'mae', secondaryMetrics: ['rmse', 'r2'], baseline: 'mean_predictor' };
    case 'anomaly_detection':
      return { primaryMetric: 'precision_at_k', secondaryMetrics: ['recall_at_k', 'alert_rate'], baseline: 'z_score_rules' };
    default:
      return { primaryMetric: 'silhouette', secondaryMetrics: ['davies_bouldin'], baseline: 'kmeans_default' };
  }
};

export const buildMlExperimentContract = (
  candidate: MlPlanningCandidateInput,
  sources: MlSourceProfile[] = []
): MlExperimentContract => {
  const source = sources.find((item) => item.sourceId === candidate.sourceId);
  const timeColumn = detectTimeColumn(source);
  const entityKeyColumn = detectEntityKey(source);
  const splitStrategy = candidate.taskType === 'forecasting' && timeColumn
    ? {
      type: 'time' as const,
      timeColumn,
      trainFraction: 0.7,
      validationFraction: 0.15,
      testFraction: 0.15
    }
    : entityKeyColumn && candidate.taskType === 'classification'
      ? {
        type: 'grouped' as const,
        entityKeyColumn,
        trainFraction: 0.7,
        validationFraction: 0.15,
        testFraction: 0.15
      }
      : {
        type: 'random' as const,
        trainFraction: 0.7,
        validationFraction: 0.15,
        testFraction: 0.15
      };

  return {
    version: 1,
    experimentId: candidate.candidateId,
    title: candidate.title,
    taskType: candidate.taskType,
    sourceId: candidate.sourceId,
    sourceName: source?.sourceName,
    targetColumn: candidate.targetColumn,
    featureColumns: candidate.featureColumns || [],
    excludedColumns: [candidate.targetColumn, entityKeyColumn].filter((value): value is string => Boolean(value)),
    splitStrategy,
    evaluation: defaultEvaluation(candidate.taskType),
    runtime: {
      executor: 'modal',
      sandboxProfile: candidate.taskType === 'forecasting' ? 'modal-cpu-medium' : 'modal-cpu-standard',
      timeoutMinutes: candidate.taskType === 'clustering' ? 45 : 60
    },
    guardrails: {
      minRowCount: candidate.taskType === 'clustering' ? 1000 : 500,
      leakageChecks: [
        'target_column_not_in_features',
        'future_information_not_used_before_prediction_cutoff',
        'entity_key_not_used_as_predictive_feature'
      ],
      missingRequirements: candidate.missingRequirements || []
    },
    expectedArtifacts: [
      'training_summary.json',
      'metrics.json',
      'feature_importance.json',
      'predictions_sample.parquet',
      'model_card.md'
    ],
    rationale: candidate.rationale,
    confidence: candidate.confidence ?? 0.5
  };
};
