import { ProjectionRegistryDocument } from './ProjectionRegistryService';
import {
    ParrotInteractionPolicyState,
    ParrotInvalidationHint,
    ParrotMLRecommendation,
    ParrotQuerySpec,
    ParrotSentinelModelName,
    ParrotSentinelModelSignal,
    ParrotSourceProfile
} from '../../types/parrot';

export interface SentinelRuntimeEvaluation {
    hints: ParrotInvalidationHint[];
    signals: ParrotSentinelModelSignal[];
}

export class CoverageRanker {
    public rank(
        sourceProfiles: ParrotSourceProfile[],
        querySpecs: ParrotQuerySpec[] = [],
        mlRecommendations: ParrotMLRecommendation[] = []
    ): ParrotSentinelModelSignal[] {
        const createdAt = new Date().toISOString();
        const signals: ParrotSentinelModelSignal[] = [];

        for (const profile of sourceProfiles) {
            const sourceQueries = querySpecs.filter((querySpec) => querySpec.sourceId === profile.sourceId);
            const generatedWidgets = new Set(sourceQueries.map((querySpec) => querySpec.widgetType));
            const required = new Set<string>(['technical-health']);
            if (profile.timestampCandidates.length > 0) required.add('weather');
            if (profile.timestampCandidates.length > 0 && profile.metricCandidates.length > 0) required.add('metric-trend');
            if (profile.metricCandidates.length > 0) required.add('ml_recommendation');

            const hasMlRecommendation = mlRecommendations.some((recommendation) => recommendation.sourceId === profile.sourceId);
            const generated = new Set([...generatedWidgets, ...(hasMlRecommendation ? ['ml_recommendation'] : [])]);
            const missing = [...required].filter((item) => !generated.has(item));
            const score = required.size === 0 ? 1 : (required.size - missing.length) / required.size;

            signals.push(this.signal(
                `coverage-${profile.sourceId}`,
                'source',
                profile.sourceId,
                profile.sourceId,
                score,
                missing.length > 0 ? 'warning' : 'info',
                missing.length > 0 ? 'coverage_gap_detected' : 'coverage_complete',
                {
                    required: [...required],
                    generated: [...generated],
                    missing
                },
                createdAt
            ));
        }

        return signals;
    }

    private signal(
        signalId: string,
        targetType: ParrotSentinelModelSignal['targetType'],
        targetId: string,
        sourceId: string | undefined,
        score: number,
        severity: ParrotSentinelModelSignal['severity'],
        reason: string,
        features: Record<string, unknown>,
        createdAt: string
    ): ParrotSentinelModelSignal {
        return {
            signalId,
            modelName: 'CoverageRanker',
            targetType,
            targetId,
            sourceId,
            score,
            severity,
            reason,
            features,
            createdAt
        };
    }
}

export class DriftClassifier {
    public classify(
        sourceProfiles: ParrotSourceProfile[],
        previousProjectionRegistry?: ProjectionRegistryDocument,
        invalidatedSources: string[] = []
    ): SentinelRuntimeEvaluation {
        const hints: ParrotInvalidationHint[] = [];
        const signals: ParrotSentinelModelSignal[] = [];
        const createdAt = new Date().toISOString();
        const projectionEntries = Object.values(previousProjectionRegistry?.projections || {});

        for (const profile of sourceProfiles) {
            const previousForSource = projectionEntries.filter((entry) => entry.sourceId === profile.sourceId);
            const fingerprintChanged = previousForSource.some((entry) => entry.inputFingerprint && entry.inputFingerprint !== profile.fingerprint);
            const explicitlyInvalidated = invalidatedSources.includes(profile.sourceId);
            const emptyPrefix = profile.storageMetrics?.objectCount === 0;
            const driftScore = emptyPrefix ? 1 : (fingerprintChanged || explicitlyInvalidated ? 0.72 : 0.05);
            const severity = emptyPrefix ? 'critical' : (driftScore > 0.5 ? 'warning' : 'info');
            const reason = emptyPrefix
                ? 'no_objects_detected_for_source_prefix'
                : (fingerprintChanged ? 'source_schema_or_partition_fingerprint_changed' : (explicitlyInvalidated ? 'source_cursor_changed' : 'source_stable'));

            signals.push(this.signal(
                `drift-${profile.sourceId}`,
                profile.sourceId,
                profile.sourceId,
                driftScore,
                severity,
                reason,
                {
                    previousProjectionCount: previousForSource.length,
                    fingerprint: profile.fingerprint,
                    invalidatedByCursor: explicitlyInvalidated,
                    objectCount: profile.storageMetrics?.objectCount
                },
                createdAt
            ));

            if (emptyPrefix || fingerprintChanged || explicitlyInvalidated) {
                hints.push({
                    id: `sentinel-${profile.sourceId}-${reason}`,
                    scope: 'source',
                    targetId: profile.sourceId,
                    sourceId: profile.sourceId,
                    reason,
                    severity,
                    invalidates: ['source', 'projection', 'query', 'widget', 'ml_recommendation'],
                    recommendedAction: emptyPrefix
                        ? 'Hold automatic widgets until the source prefix contains queryable objects.'
                        : 'Recompile projections and query specs before serving cached outputs.',
                    createdAt
                });
            }
        }

        return { hints, signals };
    }

    private signal(
        signalId: string,
        targetId: string,
        sourceId: string,
        score: number,
        severity: ParrotSentinelModelSignal['severity'],
        reason: string,
        features: Record<string, unknown>,
        createdAt: string
    ): ParrotSentinelModelSignal {
        return {
            signalId,
            modelName: 'DriftClassifier',
            targetType: 'source',
            targetId,
            sourceId,
            score,
            severity,
            reason,
            features,
            createdAt
        };
    }
}

export class QueryRiskModel {
    public evaluate(querySpecs: ParrotQuerySpec[], sourceProfiles: ParrotSourceProfile[] = []): SentinelRuntimeEvaluation {
        const hints: ParrotInvalidationHint[] = [];
        const signals: ParrotSentinelModelSignal[] = [];
        const createdAt = new Date().toISOString();
        const sourceById = new Map(sourceProfiles.map((profile) => [profile.sourceId, profile]));

        for (const querySpec of querySpecs) {
            const sql = querySpec.sql.trim().toLowerCase();
            const source = sourceById.get(querySpec.sourceId);
            const destructive = /\b(drop|delete|update|insert|alter|truncate|create|copy)\b/.test(sql);
            const unboundedLargeScan = querySpec.executionPolicy.mode === 'direct'
                && (source?.storageMetrics?.totalBytes || 0) > 5_000_000_000
                && !/\blimit\b/.test(sql)
                && !/\b(count|avg|sum|min|max)\s*\(/.test(sql);
            const missingRead = !sql.includes('read_parquet') && !sql.includes('from ');
            const riskScore = destructive ? 1 : (unboundedLargeScan ? 0.76 : (missingRead ? 0.5 : 0.08));
            const severity = destructive ? 'critical' : (riskScore > 0.7 ? 'warning' : 'info');
            const reason = destructive
                ? 'unsafe_sql_operation_detected'
                : (unboundedLargeScan ? 'unbounded_large_direct_scan' : (missingRead ? 'query_shape_unclear' : 'query_risk_low'));

            signals.push({
                signalId: `query-risk-${querySpec.queryId}`,
                modelName: 'QueryRiskModel',
                targetType: 'query',
                targetId: querySpec.queryId,
                sourceId: querySpec.sourceId,
                score: riskScore,
                severity,
                reason,
                features: {
                    widgetId: querySpec.widgetId,
                    widgetType: querySpec.widgetType,
                    executionMode: querySpec.executionPolicy.mode,
                    totalBytes: source?.storageMetrics?.totalBytes || 0
                },
                createdAt
            });

            if (destructive || unboundedLargeScan) {
                hints.push({
                    id: `sentinel-${querySpec.queryId}-${reason}`,
                    scope: 'query',
                    targetId: querySpec.queryId,
                    sourceId: querySpec.sourceId,
                    reason,
                    severity,
                    invalidates: destructive ? ['query', 'widget'] : ['widget'],
                    recommendedAction: destructive
                        ? 'Block execution until the query is rewritten as a read-only SELECT.'
                        : 'Warn the user and prefer cached or incremental execution for this query.',
                    createdAt
                });
            }
        }

        return { hints, signals };
    }
}

export class InteractionPolicyModel {
    public evaluate(
        policyState: ParrotInteractionPolicyState | undefined,
        querySpecs: ParrotQuerySpec[] = [],
        mlRecommendations: ParrotMLRecommendation[] = []
    ): ParrotSentinelModelSignal[] {
        const createdAt = new Date().toISOString();
        const state = policyState || this.emptyPolicyState();
        const signals: ParrotSentinelModelSignal[] = [];

        for (const querySpec of querySpecs) {
            const widgetWeight = state.widgetWeights[querySpec.widgetType] || 0;
            signals.push({
                signalId: `interaction-policy-${querySpec.queryId}`,
                modelName: 'InteractionPolicyModel',
                targetType: 'query',
                targetId: querySpec.queryId,
                sourceId: querySpec.sourceId,
                score: Math.max(0, Math.min(1, 0.5 + widgetWeight)),
                severity: 'info',
                reason: 'metadata_only_user_interest_prior',
                features: {
                    widgetType: querySpec.widgetType,
                    widgetWeight,
                    eventCount: state.eventCount
                },
                createdAt
            });
        }

        for (const recommendation of mlRecommendations) {
            const sourceWeight = state.sourceInterestWeights[recommendation.sourceId] || 0;
            signals.push({
                signalId: `interaction-policy-${recommendation.recommendationId}`,
                modelName: 'InteractionPolicyModel',
                targetType: 'ml_recommendation',
                targetId: recommendation.recommendationId,
                sourceId: recommendation.sourceId,
                score: Math.max(0, Math.min(1, 0.45 + sourceWeight)),
                severity: 'info',
                reason: 'metadata_only_ml_interest_prior',
                features: {
                    taskType: recommendation.taskType,
                    sourceWeight,
                    eventCount: state.eventCount
                },
                createdAt
            });
        }

        return signals;
    }

    private emptyPolicyState(): ParrotInteractionPolicyState {
        return {
            version: 1,
            updatedAt: new Date().toISOString(),
            eventCount: 0,
            rewardScore: 0,
            widgetWeights: {},
            sourceInterestWeights: {},
            modelWeights: {},
            quarantine: []
        };
    }
}

export class SentinelModelSuite {
    private readonly coverageRanker = new CoverageRanker();
    private readonly driftClassifier = new DriftClassifier();
    private readonly queryRiskModel = new QueryRiskModel();
    private readonly interactionPolicyModel = new InteractionPolicyModel();

    public evaluateRuntime(input: {
        sourceProfiles: ParrotSourceProfile[];
        previousProjectionRegistry?: ProjectionRegistryDocument;
        invalidatedSources?: string[];
        querySpecs?: ParrotQuerySpec[];
        mlRecommendations?: ParrotMLRecommendation[];
        policyState?: ParrotInteractionPolicyState;
    }): SentinelRuntimeEvaluation {
        const drift = this.driftClassifier.classify(
            input.sourceProfiles,
            input.previousProjectionRegistry,
            input.invalidatedSources || []
        );
        const queryRisk = this.queryRiskModel.evaluate(input.querySpecs || [], input.sourceProfiles);
        const coverageSignals = this.coverageRanker.rank(
            input.sourceProfiles,
            input.querySpecs || [],
            input.mlRecommendations || []
        );
        const interactionSignals = this.interactionPolicyModel.evaluate(
            input.policyState,
            input.querySpecs || [],
            input.mlRecommendations || []
        );

        return {
            hints: [...drift.hints, ...queryRisk.hints],
            signals: [
                ...drift.signals,
                ...queryRisk.signals,
                ...coverageSignals,
                ...interactionSignals
            ]
        };
    }
}
