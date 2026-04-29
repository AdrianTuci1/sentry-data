import {
    BusinessRelevanceReviewer,
    SentinelArtifact,
    SentinelReviewHint,
    SentinelReviewSignal
} from '@statsparrot/sentinel-core';
import { defaultDomainPacks } from '@statsparrot/sentinel-domain-packs';
import {
    ParrotInvalidationHint,
    ParrotQuerySpec,
    ParrotSentinelModelSignal,
    ParrotSourceProfile
} from '../../types/parrot';

export class SentinelCoreRuntimeAdapter {
    private readonly businessRelevanceReviewer = new BusinessRelevanceReviewer(defaultDomainPacks);

    public evaluateBusinessRelevance(
        querySpecs: ParrotQuerySpec[] = [],
        sourceProfiles: ParrotSourceProfile[] = []
    ): {
        hints: ParrotInvalidationHint[];
        signals: ParrotSentinelModelSignal[];
    } {
        const sourceById = new Map(sourceProfiles.map((profile) => [profile.sourceId, profile]));
        const artifacts = querySpecs.map((querySpec) => this.toQueryArtifact(querySpec, sourceById.get(querySpec.sourceId)));
        const review = this.businessRelevanceReviewer.review(artifacts);

        return {
            hints: review.hints.map((hint) => this.toInvalidationHint(hint)),
            signals: review.signals.map((signal) => this.toModelSignal(signal))
        };
    }

    private toQueryArtifact(querySpec: ParrotQuerySpec, source?: ParrotSourceProfile): SentinelArtifact {
        return {
            artifactId: querySpec.queryId,
            artifactType: 'query',
            title: querySpec.title,
            sourceId: querySpec.sourceId,
            domain: this.inferDomain(source, querySpec),
            text: [
                querySpec.widgetId,
                querySpec.widgetType,
                source?.sourceName || ''
            ].join(' '),
            sql: querySpec.sql,
            columns: [
                ...(querySpec.dependencies?.columns || []),
                ...(source?.metricCandidates || []),
                ...(source?.entityKeyCandidates || []),
                ...(source?.timestampCandidates || [])
            ],
            metrics: source?.metricCandidates || [],
            metadata: {
                widgetType: querySpec.widgetType,
                widgetId: querySpec.widgetId,
                projectionId: querySpec.projectionId
            }
        };
    }

    private inferDomain(source: ParrotSourceProfile | undefined, querySpec: ParrotQuerySpec): string | undefined {
        const haystack = [
            source?.sourceName || '',
            source?.sourceId || '',
            querySpec.title,
            querySpec.sql,
            ...(source?.metricCandidates || []),
            ...(source?.entityKeyCandidates || [])
        ].join(' ').toLowerCase();

        if (/\b(order|orders|product|products|review|reviews|delivery|customer)\b/.test(haystack)) {
            return 'ecommerce';
        }

        if (/\b(campaign|spend|roas|cac|click|impression|conversion|channel)\b/.test(haystack)) {
            return 'marketing';
        }

        if (/\b(mrr|arr|churn|activation|workspace|account|subscription)\b/.test(haystack)) {
            return 'saas';
        }

        return undefined;
    }

    private toModelSignal(signal: SentinelReviewSignal): ParrotSentinelModelSignal {
        return {
            signalId: signal.signalId,
            modelName: 'BusinessRelevanceModel',
            targetType: 'query',
            targetId: signal.artifactId,
            sourceId: undefined,
            score: signal.score,
            severity: signal.severity,
            reason: signal.reason,
            features: signal.features,
            createdAt: signal.createdAt
        };
    }

    private toInvalidationHint(hint: SentinelReviewHint): ParrotInvalidationHint {
        return {
            id: hint.hintId,
            scope: 'query',
            targetId: hint.artifactId,
            reason: hint.reason,
            severity: hint.severity,
            invalidates: ['query', 'widget'],
            recommendedAction: hint.recommendedAction,
            createdAt: hint.createdAt
        };
    }
}
