import { R2StorageService } from '../../infrastructure/storage/R2StorageService';
import {
    ParrotArtifactStatus,
    ParrotInvalidationHint,
    ParrotProjectionDependency,
    ParrotQuerySpec,
    ParrotWidgetContractRef
} from '../../types/parrot';

export interface QueryRegistryEntry {
    queryId: string;
    widgetId: string;
    projectionId: string;
    sourceId: string;
    title: string;
    widgetType: string;
    latestVersion: string;
    latestUri: string;
    latestSql: string;
    latestQueryHash: string;
    inputFingerprint: string;
    status: ParrotArtifactStatus;
    executionPolicy: ParrotQuerySpec['executionPolicy'];
    dependencies: ParrotProjectionDependency;
    widgetContract?: ParrotWidgetContractRef;
    invalidationReason?: string;
    versions: Array<{
        version: string;
        uri: string;
        queryHash: string;
        inputFingerprint: string;
        status: ParrotArtifactStatus;
        createdAt: string;
    }>;
}

export interface QueryRegistryDocument {
    version: 1;
    updatedAt: string;
    lastRequestId: string;
    queries: Record<string, QueryRegistryEntry>;
}

export class QueryRegistryService {
    constructor(private readonly r2StorageService: R2StorageService) {}

    public async registerQuerySpecs(
        tenantId: string,
        projectId: string,
        requestId: string,
        querySpecs: ParrotQuerySpec[],
        invalidationHints: ParrotInvalidationHint[] = []
    ): Promise<{ registry: QueryRegistryDocument; registryUri: string }> {
        const registry = await this.loadRegistry(tenantId, projectId);
        registry.updatedAt = new Date().toISOString();
        registry.lastRequestId = requestId;

        for (const querySpec of querySpecs) {
            const invalidation = this.findInvalidation(querySpec, invalidationHints);
            const effectiveStatus = invalidation ? this.statusForInvalidation(invalidation) : querySpec.status;
            const manifest = {
                ...querySpec,
                status: effectiveStatus,
                invalidationReason: invalidation?.reason || querySpec.invalidationReason
            };

            const result = await this.r2StorageService.saveJson(
                tenantId,
                projectId,
                'queries',
                manifest,
                querySpec.queryId,
                'versions',
                requestId,
                'query.json'
            );

            const existing = registry.queries[querySpec.queryId];
            const nextVersions = existing?.versions || [];
            if (!nextVersions.some((entry) => entry.version === requestId)) {
                nextVersions.push({
                    version: requestId,
                    uri: result.uri,
                    queryHash: querySpec.queryHash,
                    inputFingerprint: querySpec.inputFingerprint,
                    status: effectiveStatus,
                    createdAt: registry.updatedAt
                });
            }

            registry.queries[querySpec.queryId] = {
                queryId: querySpec.queryId,
                widgetId: querySpec.widgetId,
                projectionId: querySpec.projectionId,
                sourceId: querySpec.sourceId,
                title: querySpec.title,
                widgetType: querySpec.widgetType,
                latestVersion: requestId,
                latestUri: result.uri,
                latestSql: querySpec.sql,
                latestQueryHash: querySpec.queryHash,
                inputFingerprint: querySpec.inputFingerprint,
                status: effectiveStatus,
                executionPolicy: querySpec.executionPolicy,
                dependencies: querySpec.dependencies,
                widgetContract: querySpec.widgetContract,
                invalidationReason: invalidation?.reason || querySpec.invalidationReason,
                versions: nextVersions
                    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
                    .slice(-20)
            };
        }

        const registryResult = await this.r2StorageService.saveJson(
            tenantId,
            projectId,
            'queries',
            registry,
            'registry.json'
        );

        return {
            registry,
            registryUri: registryResult.uri
        };
    }

    public async loadRegistry(tenantId: string, projectId: string): Promise<QueryRegistryDocument> {
        const key = this.r2StorageService.getS3Key(tenantId, projectId, 'queries', 'registry.json');

        try {
            const content = await this.r2StorageService.getFileContent(key);
            const parsed = JSON.parse(content) as QueryRegistryDocument;
            return {
                version: 1,
                updatedAt: parsed.updatedAt || new Date().toISOString(),
                lastRequestId: parsed.lastRequestId || '',
                queries: parsed.queries || {}
            };
        } catch {
            return this.buildEmptyRegistry();
        }
    }

    private buildEmptyRegistry(): QueryRegistryDocument {
        return {
            version: 1,
            updatedAt: new Date().toISOString(),
            lastRequestId: '',
            queries: {}
        };
    }

    private findInvalidation(querySpec: ParrotQuerySpec, invalidationHints: ParrotInvalidationHint[]): ParrotInvalidationHint | undefined {
        return invalidationHints.find((hint) => {
            if (hint.targetId === querySpec.queryId || hint.scope === 'query') {
                return hint.targetId === querySpec.queryId || hint.invalidates.includes('query');
            }

            if (hint.targetId === querySpec.widgetId || hint.scope === 'widget') {
                return hint.targetId === querySpec.widgetId || hint.invalidates.includes('widget');
            }

            if (hint.targetId === querySpec.projectionId || hint.scope === 'projection') {
                return hint.targetId === querySpec.projectionId && hint.invalidates.includes('query');
            }

            if (hint.targetId === querySpec.sourceId || hint.sourceId === querySpec.sourceId) {
                return hint.invalidates.includes('query') || hint.invalidates.includes('projection') || hint.invalidates.includes('source');
            }

            return false;
        });
    }

    private statusForInvalidation(invalidation: ParrotInvalidationHint): ParrotArtifactStatus {
        if (invalidation.severity === 'critical') return 'invalidated';
        return 'stale';
    }
}
