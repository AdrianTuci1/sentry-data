"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSentinelCore = exports.SentinelCore = exports.BusinessRelevanceReviewer = void 0;
const DEFAULT_BUSINESS_KEYWORDS = [
    'revenue',
    'gmv',
    'sales',
    'aov',
    'ltv',
    'roas',
    'cac',
    'margin',
    'profit',
    'order',
    'delivery',
    'review',
    'retention',
    'conversion',
    'refund',
    'return',
    'customer',
    'cohort',
    'churn',
    'repeat',
    'status',
    'category'
];
const DEFAULT_LOW_SIGNAL_PATTERNS = [
    /row[_\s-]*count/i,
    /freshness/i,
    /snapshot/i,
    /name[_\s-]*lenght/i,
    /name[_\s-]*length/i,
    /description[_\s-]*lenght/i,
    /description[_\s-]*length/i,
    /\blength\b/i,
    /\btotal rows?\b/i
];
class BusinessRelevanceReviewer {
    constructor(domainPacks = []) {
        this.domainPacks = domainPacks;
    }
    review(artifacts) {
        const createdAt = new Date().toISOString();
        const signals = [];
        const hints = [];
        for (const artifact of artifacts) {
            const pack = this.resolveDomainPack(artifact.domain);
            const businessKeywords = [
                ...DEFAULT_BUSINESS_KEYWORDS,
                ...(pack?.businessKeywords || [])
            ];
            const lowSignalPatterns = [
                ...DEFAULT_LOW_SIGNAL_PATTERNS,
                ...(pack?.lowSignalPatterns || [])
            ];
            const haystack = [
                artifact.artifactId,
                artifact.title || '',
                artifact.text || '',
                artifact.sql || '',
                ...(artifact.columns || []),
                ...(artifact.metrics || [])
            ].join(' ');
            const matchedPatterns = lowSignalPatterns
                .filter((pattern) => pattern.test(haystack))
                .map((pattern) => pattern.source);
            const normalizedHaystack = haystack.toLowerCase();
            const matchedBusinessKeywords = businessKeywords.filter((keyword) => normalizedHaystack.includes(keyword));
            let score = 0.78;
            const reasons = [];
            if (matchedPatterns.length > 0) {
                score = Math.min(score, 0.22);
                reasons.push('schema_profiling_artifact');
            }
            if (artifact.artifactType === 'query' && /\b(count|avg|average)\b/i.test(artifact.title || '') && matchedBusinessKeywords.length === 0) {
                score = Math.min(score, 0.34);
                reasons.push('generic_aggregate_without_business_context');
            }
            if (matchedBusinessKeywords.length > 0 && matchedPatterns.length === 0) {
                score = Math.max(score, 0.9);
            }
            const reason = reasons[0] || 'business_relevance_ok';
            const severity = score < 0.35 ? 'warning' : 'info';
            signals.push({
                signalId: `business-relevance-${artifact.artifactId}`,
                artifactId: artifact.artifactId,
                artifactType: artifact.artifactType,
                modelName: 'BusinessRelevanceReviewer',
                category: 'relevance',
                score,
                severity,
                reason,
                features: {
                    domain: artifact.domain,
                    matchedPatterns,
                    matchedBusinessKeywords,
                    preferredAnalysisShapes: pack?.preferredAnalysisShapes || []
                },
                createdAt
            });
            if (score < 0.35) {
                hints.push({
                    hintId: `sentinel-${artifact.artifactId}-low-relevance`,
                    artifactId: artifact.artifactId,
                    artifactType: artifact.artifactType,
                    category: 'relevance',
                    severity: 'warning',
                    reason: 'low_business_relevance',
                    recommendedAction: 'Keep this artifact out of the primary answer and prefer business-facing comparisons, movement, or decision metrics.',
                    createdAt
                });
            }
        }
        return { signals, hints };
    }
    resolveDomainPack(domain) {
        if (!domain) {
            return undefined;
        }
        return this.domainPacks.find((pack) => pack.domain === domain);
    }
}
exports.BusinessRelevanceReviewer = BusinessRelevanceReviewer;
class SentinelCore {
    constructor(reviewers = [new BusinessRelevanceReviewer()]) {
        this.reviewers = reviewers;
    }
    review(artifacts) {
        return this.reviewers.reduce((combined, reviewer) => {
            const result = reviewer.review(artifacts);
            combined.signals.push(...result.signals);
            combined.hints.push(...result.hints);
            return combined;
        }, { signals: [], hints: [] });
    }
}
exports.SentinelCore = SentinelCore;
const createSentinelCore = (domainPacks = []) => (new SentinelCore([
    new BusinessRelevanceReviewer(domainPacks)
]));
exports.createSentinelCore = createSentinelCore;
