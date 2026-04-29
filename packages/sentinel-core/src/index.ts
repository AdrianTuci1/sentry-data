export type SentinelArtifactType =
  | 'dataset_profile'
  | 'query'
  | 'insight'
  | 'metric'
  | 'feature_set'
  | 'model_run'
  | 'visualization'
  | 'claim'
  | 'notebook_cell';

export type SentinelReviewCategory =
  | 'validity'
  | 'safety'
  | 'cost'
  | 'confidence'
  | 'evidence'
  | 'actionability'
  | 'relevance';

export type SentinelSeverity = 'info' | 'warning' | 'critical';

export interface SentinelArtifact {
  artifactId: string;
  artifactType: SentinelArtifactType;
  title?: string;
  sourceId?: string;
  domain?: string;
  text?: string;
  sql?: string;
  columns?: string[];
  metrics?: string[];
  metadata?: Record<string, unknown>;
}

export interface SentinelReviewSignal {
  signalId: string;
  artifactId: string;
  artifactType: SentinelArtifactType;
  modelName: string;
  category: SentinelReviewCategory;
  score: number;
  severity: SentinelSeverity;
  reason: string;
  features: Record<string, unknown>;
  createdAt: string;
}

export interface SentinelReviewHint {
  hintId: string;
  artifactId: string;
  artifactType: SentinelArtifactType;
  category: SentinelReviewCategory;
  severity: SentinelSeverity;
  reason: string;
  recommendedAction: string;
  createdAt: string;
}

export interface SentinelReviewResult {
  signals: SentinelReviewSignal[];
  hints: SentinelReviewHint[];
}

export interface SentinelDomainPack {
  domain: string;
  businessKeywords?: string[];
  lowSignalPatterns?: RegExp[];
  preferredAnalysisShapes?: string[];
}

export interface SentinelReviewer {
  review(artifacts: SentinelArtifact[]): SentinelReviewResult;
}

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

export class BusinessRelevanceReviewer implements SentinelReviewer {
  constructor(private readonly domainPacks: SentinelDomainPack[] = []) {}

  public review(artifacts: SentinelArtifact[]): SentinelReviewResult {
    const createdAt = new Date().toISOString();
    const signals: SentinelReviewSignal[] = [];
    const hints: SentinelReviewHint[] = [];

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
      const reasons: string[] = [];

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
      const severity: SentinelSeverity = score < 0.35 ? 'warning' : 'info';

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

  private resolveDomainPack(domain?: string): SentinelDomainPack | undefined {
    if (!domain) {
      return undefined;
    }

    return this.domainPacks.find((pack) => pack.domain === domain);
  }
}

export class SentinelCore implements SentinelReviewer {
  constructor(private readonly reviewers: SentinelReviewer[] = [new BusinessRelevanceReviewer()]) {}

  public review(artifacts: SentinelArtifact[]): SentinelReviewResult {
    return this.reviewers.reduce<SentinelReviewResult>(
      (combined, reviewer) => {
        const result = reviewer.review(artifacts);
        combined.signals.push(...result.signals);
        combined.hints.push(...result.hints);
        return combined;
      },
      { signals: [], hints: [] }
    );
  }
}

export const createSentinelCore = (domainPacks: SentinelDomainPack[] = []) => (
  new SentinelCore([
    new BusinessRelevanceReviewer(domainPacks)
  ])
);
