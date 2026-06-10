export interface SentinelDomainPackDefinition {
    domain: string;
    displayName: string;
    businessKeywords: string[];
    lowSignalPatterns: RegExp[];
    preferredAnalysisShapes: string[];
    metricHints: Array<{
        metricId: string;
        title: string;
        requiresAny: string[];
        requiresAll?: string[];
        description: string;
    }>;
}
export declare const ecommerceDomainPack: SentinelDomainPackDefinition;
export declare const marketingDomainPack: SentinelDomainPackDefinition;
export declare const saasDomainPack: SentinelDomainPackDefinition;
export declare const defaultDomainPacks: SentinelDomainPackDefinition[];
export declare const resolveDomainPack: (domain?: string) => SentinelDomainPackDefinition | undefined;
