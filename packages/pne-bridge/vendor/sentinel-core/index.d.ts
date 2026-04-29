export type SentinelArtifactType = 'dataset_profile' | 'query' | 'insight' | 'metric' | 'feature_set' | 'model_run' | 'visualization' | 'claim' | 'notebook_cell';
export type SentinelReviewCategory = 'validity' | 'safety' | 'cost' | 'confidence' | 'evidence' | 'actionability' | 'relevance';
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
export declare class BusinessRelevanceReviewer implements SentinelReviewer {
    private readonly domainPacks;
    constructor(domainPacks?: SentinelDomainPack[]);
    review(artifacts: SentinelArtifact[]): SentinelReviewResult;
    private resolveDomainPack;
}
export declare class SentinelCore implements SentinelReviewer {
    private readonly reviewers;
    constructor(reviewers?: SentinelReviewer[]);
    review(artifacts: SentinelArtifact[]): SentinelReviewResult;
}
export declare const createSentinelCore: (domainPacks?: SentinelDomainPack[]) => SentinelCore;
