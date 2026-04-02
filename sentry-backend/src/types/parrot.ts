export type ParrotRuntimeMode = 'parrot_os';
export type ParrotProgressStatus = 'planning' | 'aligned' | 'executing' | 'completed' | 'error';
export type ParrotExecutionEngine = 'modal' | 'ray_daft';
export type ParrotExecutionSubmissionStatus = 'planned' | 'submitted' | 'deferred' | 'unavailable' | 'failed';

export interface DnsTxtVerificationState {
    required: boolean;
    recordName: string;
    domain?: string;
    verified: boolean;
    verifiedAt?: string;
    status: 'pending_dns_verification' | 'verified' | 'failed';
}

export interface ReverseEtlLimits {
    maxUnverifiedVms: number;
    stopOnErrors: string[];
    consecutiveErrorThreshold: number;
    requireManualVerificationAfterLimit: boolean;
}

export interface ReverseEtlStreamPlan {
    enabled: boolean;
    vmMode: 'user_owned';
    dnsTxtVerification: DnsTxtVerificationState;
    deliveryTargets: string[];
    limits: ReverseEtlLimits;
    activeVmCount: number;
    status: 'pending_dns_verification' | 'ready' | 'limited';
}

export interface ParrotRuntimeMetadata {
    mode: ParrotRuntimeMode;
    lastRequestId?: string;
    status?: ParrotProgressStatus;
    executionScoreUri?: string;
    progressFileUri?: string;
    sentinelReportUri?: string;
    outputManifestUri?: string;
    reverseEtlReceiptsUri?: string;
    sourceFingerprint?: string;
    translatorVersion?: string;
    updatedAt?: string;
    reverseEtl?: ReverseEtlStreamPlan;
    sourceMetadataUris?: string[];
    mindmapYamlUri?: string;
    executionPlanUri?: string;
    executionSubmissionUri?: string;
    executionEngine?: ParrotExecutionEngine;
    executionStatus?: ParrotExecutionSubmissionStatus;
}

export interface ParrotSchemaColumn {
    name: string;
    type: string;
    semanticType: 'id' | 'timestamp' | 'metric' | 'dimension' | 'json' | 'unknown';
}

export interface ParrotMindMapSuggestion {
    id: string;
    source: 'pne' | 'sentinel';
    mode: 'intent' | 'code';
    title: string;
    rationale: string;
    proposedIntent?: string;
    proposedCode?: string;
    confidence?: number;
}

export interface ParrotValidationCheck {
    name: 'syntax' | 'schema' | 'lineage' | 'widget_contract' | 'dry_run' | 'safety';
    status: 'pending' | 'passed' | 'failed';
    message: string;
}

export interface ParrotValidationState {
    status: 'draft' | 'validated' | 'rejected' | 'active';
    checks: ParrotValidationCheck[];
    lastValidatedAt?: string;
}

export interface ParrotEditableLogic {
    intent: string;
    code?: string;
    compiled_code?: string;
    effective_query?: string;
}

export interface ParrotWidgetContractRef {
    widgetType: string;
    expectedShape: 'scalar' | 'timeseries' | 'categorical_breakdown' | 'table' | 'unknown';
    requiredFields: string[];
    alignmentMode: 'strict' | 'best_effort';
    source: 'catalog_manifest' | 'runtime_contract';
}

export interface ParrotSourceTransformation {
    id: string;
    title: string;
    intent: string;
    code?: string;
    editMode: 'intent' | 'code';
    compiledCode?: string;
    suggestions?: ParrotMindMapSuggestion[];
    validation?: ParrotValidationState;
}

export interface ParrotGoldView {
    id: string;
    title: string;
    description: string;
    columns: ParrotSchemaColumn[];
    editMode?: 'intent' | 'code';
    logic?: ParrotEditableLogic;
    suggestions?: ParrotMindMapSuggestion[];
    validation?: ParrotValidationState;
}

export interface ParrotSourceProfile {
    sourceId: string;
    sourceName: string;
    sourceType: string;
    uri: string;
    fingerprint: string;
    schema: ParrotSchemaColumn[];
    sampleRows: Array<Record<string, unknown>>;
    entityKeyCandidates: string[];
    timestampCandidates: string[];
    metricCandidates: string[];
    transformations: ParrotSourceTransformation[];
    goldViews: ParrotGoldView[];
    metadataUri?: string;
}

export interface ParrotMindMapGroup {
    id: string;
    name: string;
    title: string;
    status: 'active' | 'recommended';
    color: 'default' | 'blue';
    activationMode: 'automatic' | 'manual';
    sourceIds: string[];
    adjusted_data_ids?: string[];
    editMode?: 'intent' | 'code';
    logic?: ParrotEditableLogic;
    suggestions?: ParrotMindMapSuggestion[];
    validation?: ParrotValidationState;
}

export interface ParrotMindMapInsight {
    id: string;
    title: string;
    type: string;
    widget_type: string;
    group_id: string;
    status: 'active' | 'recommended';
    activationMode: 'automatic' | 'manual';
    adjusted_data_columns: string[];
    query?: string;
    sql?: string;
    logic: ParrotEditableLogic;
    lineage: {
        source_keys: string[];
    };
    editMode: 'intent' | 'code';
    suggestions?: ParrotMindMapSuggestion[];
    validation?: ParrotValidationState;
    widgetContract?: ParrotWidgetContractRef;
}

export interface ParrotMindMapManifest {
    version: string;
    runtime: {
        mode: 'parrot_os';
        executionEngine: string;
        decisionEngine: string;
        mlLaunchPolicy: 'manual_recommended';
    };
    editing: {
        supportedModes: Array<'intent' | 'code'>;
        sentinelGuard: string;
        lifecycle: Array<'draft' | 'compile' | 'dry_run' | 'sentinel_validate' | 'activate'>;
        layerPolicies: {
            sources: {
                supportedModes: Array<'intent' | 'code'>;
                submissionMode: 'draft_patch';
            };
            transformations: {
                supportedModes: Array<'intent' | 'code'>;
                submissionMode: 'draft_patch';
            };
            gold: {
                supportedModes: Array<'intent' | 'code'>;
                submissionMode: 'draft_patch';
            };
            groups: {
                supportedModes: Array<'intent' | 'code'>;
                submissionMode: 'draft_patch';
            };
            insights: {
                supportedModes: Array<'intent' | 'code'>;
                submissionMode: 'draft_patch';
            };
        };
        widgetContracts: {
            policy: string;
            enforcement: Array<'query_shape' | 'field_requirements' | 'fallback_template'>;
        };
        feedbackLoop: {
            mode: 'metadata_only';
            automaticExecution: false;
            learningScope: string;
        };
    };
    layers: {
        sources: Array<{
            id: string;
            name: string;
            type: string;
            uri: string;
            metadata_uri?: string;
        }>;
        transformations: Record<string, ParrotSourceTransformation[]>;
        gold: Record<string, ParrotGoldView[]>;
        groups: ParrotMindMapGroup[];
        insights: ParrotMindMapInsight[];
    };
}

export interface ParrotExecutionPlan {
    plan_id: string;
    request_id: string;
    engine: ParrotExecutionEngine;
    planner_version: string;
    execution_plane: 'modal' | 'kubernetes_ray';
    workload_class: 'small' | 'medium' | 'large';
    source_count: number;
    estimated_columns: number;
    estimated_metric_columns: number;
    estimated_gold_views: number;
    target_latency_ms: number;
    scheduler: {
        platform: 'modal' | 'kubernetes';
        queue: string;
        namespace?: string;
        cluster?: string;
        autoscaling: boolean;
    };
    resources: {
        driver_cpu: number;
        driver_memory_gb: number;
        worker_cpu: number;
        worker_memory_gb: number;
        min_workers: number;
        max_workers: number;
    };
    routing: {
        preferred_provider: ParrotExecutionEngine;
        fallback_provider: ParrotExecutionEngine | null;
    };
    reasons: string[];
}

export interface ParrotExecutionSubmission {
    submission_id: string;
    request_id: string;
    engine: ParrotExecutionEngine;
    provider: string;
    status: ParrotExecutionSubmissionStatus;
    submitted_at: string;
    endpoint?: string;
    message?: string;
    response?: unknown;
}

export interface ParrotExecutionScore {
    metadata: {
        request_id: string;
        priority: 'high' | 'normal' | 'low';
        target_latency_ms: number;
        runtime_mode: 'parrot_os';
        translator_version: string;
        source_fingerprint: string;
        created_at: string;
    };
    source: {
        type: string;
        uri: string;
        uris: string[];
        source_names: string[];
        schema_discovery: 'dynamic';
        sampling_rate: number;
    };
    pnc_logic: {
        virtual_silver: Array<Record<string, unknown>>;
        virtual_gold_features: Array<Record<string, unknown>>;
    };
    analysis_goal: {
        type: string;
        group_by: string[];
        metrics: string[];
        transformers_options: Record<string, unknown>;
    };
    sentinel_constraints: {
        max_null_ratio: number;
        allow_outliers: boolean;
        expected_distribution: string;
        fail_on_anomaly: string;
    };
    infrastructure: {
        engine: string;
        worker_type: string;
        min_workers: number;
        max_workers: number;
        auto_scale: boolean;
    };
    output_streams: {
        reverse_etl: {
            enabled: boolean;
            vm_mode: 'user_owned';
            dns_txt_verification: {
                required: boolean;
                record_name: string;
                domain?: string;
                verified: boolean;
            };
            delivery_targets: string[];
            limits: ReverseEtlLimits;
            active_vm_count: number;
            status: 'pending_dns_verification' | 'ready' | 'limited';
        };
    };
}

export interface ParrotArtifactUris {
    executionScoreUri: string;
    progressFileUri: string;
    sentinelReportUri: string;
    outputManifestUri: string;
    reverseEtlReceiptsUri: string;
    executionPlanUri: string;
    executionSubmissionUri: string;
}

export interface ParrotProgressFile {
    request_id: string;
    source_fingerprint: string;
    translator_version: string;
    status: ParrotProgressStatus;
    last_completed_stage: string;
    delta: {
        new_partitions: string[];
        replayed_history: boolean;
    };
    artifacts: ParrotArtifactUris;
    warnings?: string[];
    errors?: string[];
    reverse_etl: {
        status: 'pending_dns_verification' | 'ready' | 'limited';
        dns_txt_verification_required: boolean;
        active_vm_count: number;
    };
    updated_at: string;
}

export interface ParrotSentinelReport {
    status: string;
    aligned: boolean;
    shouldReplan: boolean;
    reasons: string[];
    executionScoreVersion: string;
    checkedAt: string;
    details?: unknown;
}

export interface ParrotOutputManifest {
    request_id: string;
    mode: 'parrot_os';
    dashboards: number;
    insights: number;
    reverse_etl: {
        status: 'pending_dns_verification' | 'ready' | 'limited';
        delivery_targets: string[];
        active_vm_count: number;
        dns_verified: boolean;
    };
    emitted_at: string;
}

export interface ReverseEtlReceipt {
    target: string;
    status: 'pending' | 'sent' | 'skipped';
    reason?: string;
    emittedAt: string;
}

export interface ParrotBootstrapResult {
    requestId: string;
    executionScore: ParrotExecutionScore;
    progressFile: ParrotProgressFile;
    sentinelReport: ParrotSentinelReport;
    artifacts: ParrotArtifactUris;
    reverseEtl: ReverseEtlStreamPlan;
}
