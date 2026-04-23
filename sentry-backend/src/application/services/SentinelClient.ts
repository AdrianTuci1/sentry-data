import { config } from '../../config';
import { ProjectionRegistryDocument } from './ProjectionRegistryService';
import {
    ParrotInteractionPolicyState,
    ParrotInvalidationHint,
    ParrotMLRecommendation,
    ParrotQuerySpec,
    ParrotSentinelModelSignal,
    ParrotSourceProfile
} from '../../types/parrot';
import { SentinelModelSuite } from './SentinelModels';

export interface SentinelGoalResponse {
    status: string;
    confidence_score: number;
    goals: string[];
    should_invalidate: boolean;
    reinforcement_learning?: any;
    details?: any;
}

export interface SentinelAlignmentResponse {
    status: string;
    aligned: boolean;
    shouldReplan: boolean;
    reasons: string[];
    executionScore: any;
    details?: any;
}

export class SentinelClient {
    private baseUrl: string;
    private readonly modelSuite = new SentinelModelSuite();
    private lastModelSignals: ParrotSentinelModelSignal[] = [];

    constructor() {
        this.baseUrl = config.parrot.sentinelApiUrl;
    }

    public async evaluateNode(tenantId: string, projectId: string, nodeId: string, dataSample: any[], scope: 'source' | 'global' = 'source'): Promise<SentinelGoalResponse | null> {
        if (!this.baseUrl) {
            return null;
        }

        try {
            console.log(`[SentinelClient] Evaluating node ${nodeId} for project ${projectId} (Scope: ${scope})`);
            const response = await fetch(this.resolveApiUrl('evaluate_node'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Internal-Secret': config.worker.secret
                },
                body: JSON.stringify({
                    tenant_id: tenantId,
                    project_id: projectId,
                    node_id: nodeId,
                    scope,
                    data_sample: dataSample
                })
            });

            if (!response.ok) {
                console.warn(`[SentinelClient] Request failed with status ${response.status}`);
                return null;
            }

            const data = await response.json();
            return data as SentinelGoalResponse;
        } catch (error) {
            console.error(`[SentinelClient] Error calling Sentinel API:`, error);
            // If Sentinel is down, we don't want to crash the main orchestrator, just bypass RL goals
            return null;
        }
    }

    public async alignExecutionScore(tenantId: string, projectId: string, executionScore: any): Promise<SentinelAlignmentResponse> {
        if (!this.baseUrl) {
            return this.buildFallbackAlignment(executionScore, 'sentinel_not_configured');
        }

        try {
            console.log(`[SentinelClient] Aligning execution score for project ${projectId}...`);
            console.log(`[PNE -> Sentinel] Alignment Proposal Fingerprint: ${executionScore.metadata.source_fingerprint}`);
            
            if (process.env.VERBOSE_LOGGING === 'true') {
                console.log('[PNE -> Sentinel] Full Proposal:', JSON.stringify(executionScore, null, 2));
            }

            const response = await fetch(this.resolveApiUrl('align_execution_score'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Internal-Secret': config.worker.secret
                },
                body: JSON.stringify({
                    tenant_id: tenantId,
                    project_id: projectId,
                    execution_score: executionScore
                })
            });

            if (!response.ok) {
                console.warn(`[SentinelClient] Alignment request failed with status ${response.status}`);
                return this.buildFallbackAlignment(executionScore, `sentinel_http_${response.status}`);
            }

            const data = await response.json();
            const result: SentinelAlignmentResponse = {
                status: data.status || 'aligned',
                aligned: data.aligned !== false,
                shouldReplan: data.should_replan === true,
                reasons: Array.isArray(data.reasons) ? data.reasons : [],
                executionScore: data.execution_score || executionScore,
                details: data.details
            };

            console.log(`[Sentinel -> PNE] Alignment Decision: ${result.status.toUpperCase()} (Aligned: ${result.aligned})`);
            if (result.reasons.length > 0) {
                console.log(`[Sentinel -> PNE] Reasons: ${result.reasons.join(', ')}`);
            }
            if (process.env.VERBOSE_LOGGING === 'true' && result.details) {
                console.log('[Sentinel -> PNE] Model Signals:', JSON.stringify(result.details, null, 2));
            }

            return result;
        } catch (error) {
            console.error(`[SentinelClient] Error aligning execution score:`, error);
            return this.buildFallbackAlignment(executionScore, 'sentinel_unavailable');
        }
    }

    public async buildInvalidationHints(
        tenantId: string,
        projectId: string,
        sourceProfiles: ParrotSourceProfile[],
        previousProjectionRegistry?: ProjectionRegistryDocument,
        invalidatedSources: string[] = [],
        querySpecs: ParrotQuerySpec[] = [],
        mlRecommendations: ParrotMLRecommendation[] = [],
        policyState?: ParrotInteractionPolicyState
    ): Promise<ParrotInvalidationHint[]> {
        if (this.baseUrl) {
            try {
                const response = await fetch(this.resolveApiUrl('evaluate_runtime'), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Internal-Secret': config.worker.secret
                    },
                    body: JSON.stringify({
                        tenant_id: tenantId,
                        project_id: projectId,
                        source_profiles: sourceProfiles,
                        previous_projection_registry: previousProjectionRegistry,
                        invalidated_sources: invalidatedSources,
                        query_specs: querySpecs,
                        ml_recommendations: mlRecommendations,
                        policy_state: policyState
                    })
                });

                const data = await response.json().catch(() => ({}));
                if (Array.isArray(data.sentinel_model_signals)) {
                    this.lastModelSignals = data.sentinel_model_signals as ParrotSentinelModelSignal[];
                }
                if (response.ok && Array.isArray(data.invalidation_hints)) {
                    return data.invalidation_hints as ParrotInvalidationHint[];
                }

                console.warn(`[SentinelClient] Runtime evaluation failed with status ${response.status}. Using local invalidation heuristics.`);
            } catch (error) {
                console.warn('[SentinelClient] Runtime evaluation unavailable. Using local invalidation heuristics.', error);
            }
        }

        const evaluation = this.modelSuite.evaluateRuntime({
            sourceProfiles,
            previousProjectionRegistry,
            invalidatedSources,
            querySpecs,
            mlRecommendations,
            policyState
        });
        this.lastModelSignals = evaluation.signals;

        return this.buildLocalInvalidationHints(sourceProfiles, previousProjectionRegistry, invalidatedSources, evaluation.hints);
    }

    public getLastModelSignals(): ParrotSentinelModelSignal[] {
        return this.lastModelSignals;
    }

    private buildFallbackAlignment(executionScore: any, reason: string): SentinelAlignmentResponse {
        return {
            status: 'fallback_aligned',
            aligned: true,
            shouldReplan: false,
            reasons: [reason],
            executionScore,
            details: {
                mode: 'local_fallback'
            }
        };
    }

    private buildLocalInvalidationHints(
        sourceProfiles: ParrotSourceProfile[],
        previousProjectionRegistry?: ProjectionRegistryDocument,
        invalidatedSources: string[] = [],
        modelHints: ParrotInvalidationHint[] = []
    ): ParrotInvalidationHint[] {
        const hints: ParrotInvalidationHint[] = [...modelHints];
        const createdAt = new Date().toISOString();
        const projectionEntries = Object.values(previousProjectionRegistry?.projections || {});

        for (const profile of sourceProfiles) {
            if (invalidatedSources.includes(profile.sourceId)) {
                hints.push(this.buildHint(
                    `sentinel-${profile.sourceId}-source-invalidated`,
                    'source',
                    profile.sourceId,
                    profile.sourceId,
                    'source_cursor_changed',
                    'warning',
                    ['source', 'projection', 'query', 'widget', 'ml_recommendation'],
                    'Recompile projections and query specs for this source before serving cached outputs.',
                    createdAt
                ));
            }

            const previousForSource = projectionEntries.filter((entry) => entry.sourceId === profile.sourceId);
            const fingerprintChanged = previousForSource.some((entry) => entry.inputFingerprint && entry.inputFingerprint !== profile.fingerprint);
            if (fingerprintChanged) {
                hints.push(this.buildHint(
                    `sentinel-${profile.sourceId}-fingerprint-drift`,
                    'source',
                    profile.sourceId,
                    profile.sourceId,
                    'source_schema_or_partition_fingerprint_changed',
                    'warning',
                    ['projection', 'query', 'widget', 'ml_recommendation'],
                    'Invalidate dependent query results and compile a new projection version from the raw source.',
                    createdAt
                ));
            }

            if (profile.storageMetrics && profile.storageMetrics.objectCount === 0) {
                hints.push(this.buildHint(
                    `sentinel-${profile.sourceId}-empty-prefix`,
                    'source',
                    profile.sourceId,
                    profile.sourceId,
                    'no_objects_detected_for_source_prefix',
                    'critical',
                    ['source', 'projection', 'query', 'widget', 'ml_recommendation'],
                    'Hold automatic widgets until the source prefix contains queryable objects.',
                    createdAt
                ));
            }

            if (profile.metricCandidates.length === 0) {
                hints.push(this.buildHint(
                    `sentinel-${profile.sourceId}-no-metrics`,
                    'source',
                    profile.sourceId,
                    profile.sourceId,
                    'metric_candidates_missing',
                    'info',
                    ['widget', 'ml_recommendation'],
                    'Prefer coverage and freshness widgets; skip supervised ML recommendations until metrics are detected.',
                    createdAt
                ));
            }

            if (profile.timestampCandidates.length === 0) {
                hints.push(this.buildHint(
                    `sentinel-${profile.sourceId}-no-timestamps`,
                    'source',
                    profile.sourceId,
                    profile.sourceId,
                    'timestamp_candidates_missing',
                    'info',
                    ['widget', 'ml_recommendation'],
                    'Avoid time-series widgets and use snapshot-safe queries for this source.',
                    createdAt
                ));
            }
        }

        return this.dedupeHints(hints);
    }

    private dedupeHints(hints: ParrotInvalidationHint[]): ParrotInvalidationHint[] {
        const seen = new Set<string>();
        return hints.filter((hint) => {
            const key = `${hint.scope}:${hint.targetId}:${hint.reason}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    private buildHint(
        id: string,
        scope: ParrotInvalidationHint['scope'],
        targetId: string,
        sourceId: string | undefined,
        reason: string,
        severity: ParrotInvalidationHint['severity'],
        invalidates: ParrotInvalidationHint['invalidates'],
        recommendedAction: string,
        createdAt: string
    ): ParrotInvalidationHint {
        return {
            id,
            scope,
            targetId,
            sourceId,
            reason,
            severity,
            invalidates,
            recommendedAction,
            createdAt
        };
    }

    private resolveApiUrl(path: string): string {
        const normalized = this.baseUrl.replace(/\/+$/, '');
        if (normalized.endsWith('/api/v1')) {
            return `${normalized}/${path}`;
        }

        return `${normalized}/api/v1/${path}`;
    }
}
