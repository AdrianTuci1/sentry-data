import { R2StorageService } from '../../infrastructure/storage/R2StorageService';
import {
    ParrotArtifactStatus,
    ParrotInvalidationHint,
    ParrotProjectionDependency,
    ParrotProjectionMaterializationPolicy,
    ParrotProjectionSpec,
    ParrotSourceProfile
} from '../../types/parrot';

export interface ProjectionRegistryEntry {
    projectionId: string;
    title: string;
    sourceId: string;
    sourceName: string;
    latestVersion: string;
    latestUri: string;
    status: ParrotArtifactStatus;
    materialization: ParrotProjectionMaterializationPolicy;
    inputFingerprint: string;
    specHash: string;
    dependency: ParrotProjectionDependency;
    invalidationReason?: string;
    columns: string[];
    versions: Array<{
        version: string;
        uri: string;
        createdAt: string;
        inputFingerprint?: string;
        specHash?: string;
        status?: ParrotArtifactStatus;
    }>;
}

export interface ProjectionRegistryDocument {
    version: 1;
    updatedAt: string;
    lastRequestId: string;
    projections: Record<string, ProjectionRegistryEntry>;
}

export class ProjectionRegistryService {
    constructor(private readonly r2StorageService: R2StorageService) {}

    public async registerSourceProfiles(
        tenantId: string,
        projectId: string,
        requestId: string,
        sourceProfiles: ParrotSourceProfile[]
    ): Promise<{ registry: ProjectionRegistryDocument; registryUri: string }> {
        const projectionSpecs = sourceProfiles.flatMap((profile) => profile.goldViews.map((goldView) => ({
            projectionId: goldView.id,
            title: goldView.title,
            sourceId: profile.sourceId,
            sourceName: profile.sourceName,
            version: requestId,
            rawUri: profile.uri,
            servingUri: profile.uri,
            status: 'active' as const,
            materialization: 'virtual' as const,
            inputFingerprint: profile.fingerprint,
            specHash: `${profile.fingerprint}:${goldView.id}`,
            dependency: {
                sourceIds: [profile.sourceId],
                columns: goldView.columns.map((column) => column.name)
            },
            columns: goldView.columns,
            logic: goldView.logic || { intent: goldView.description },
            storageMetrics: profile.storageMetrics,
            createdAt: new Date().toISOString()
        } satisfies ParrotProjectionSpec)));

        const result = await this.registerProjectionSpecs(tenantId, projectId, requestId, projectionSpecs, []);

        for (const profile of sourceProfiles) {
            for (const goldView of profile.goldViews) {
                const entry = result.registry.projections[goldView.id];
                if (entry) {
                    goldView.projectionVersion = entry.latestVersion;
                    goldView.projectionUri = entry.latestUri;
                }
            }
        }

        return result;
    }

    public async registerProjectionSpecs(
        tenantId: string,
        projectId: string,
        requestId: string,
        projectionSpecs: ParrotProjectionSpec[],
        invalidationHints: ParrotInvalidationHint[] = []
    ): Promise<{ registry: ProjectionRegistryDocument; registryUri: string }> {
        const registry = await this.loadRegistry(tenantId, projectId);
        registry.updatedAt = new Date().toISOString();
        registry.lastRequestId = requestId;

        for (const projectionSpec of projectionSpecs) {
            const invalidation = this.findInvalidation(projectionSpec, invalidationHints);
            const effectiveStatus = invalidation ? this.statusForInvalidation(invalidation) : projectionSpec.status;
            const manifest = {
                ...projectionSpec,
                status: effectiveStatus,
                invalidationReason: invalidation?.reason || projectionSpec.invalidationReason
            };

            const result = await this.r2StorageService.saveJson(
                tenantId,
                projectId,
                'projections',
                manifest,
                projectionSpec.projectionId,
                'versions',
                requestId,
                'manifest.json'
            );

            const existing = registry.projections[projectionSpec.projectionId];
            const nextVersions = existing?.versions || [];
            if (!nextVersions.some((entry) => entry.version === requestId)) {
                nextVersions.push({
                    version: requestId,
                    uri: result.uri,
                    createdAt: registry.updatedAt,
                    inputFingerprint: projectionSpec.inputFingerprint,
                    specHash: projectionSpec.specHash,
                    status: effectiveStatus
                });
            }

            registry.projections[projectionSpec.projectionId] = {
                projectionId: projectionSpec.projectionId,
                title: projectionSpec.title,
                sourceId: projectionSpec.sourceId,
                sourceName: projectionSpec.sourceName,
                latestVersion: requestId,
                latestUri: result.uri,
                status: effectiveStatus,
                materialization: projectionSpec.materialization,
                inputFingerprint: projectionSpec.inputFingerprint,
                specHash: projectionSpec.specHash,
                dependency: projectionSpec.dependency,
                invalidationReason: invalidation?.reason || projectionSpec.invalidationReason,
                columns: projectionSpec.columns.map((column) => column.name),
                versions: nextVersions
                    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
                    .slice(-20),
            };
        }

        const registryResult = await this.r2StorageService.saveJson(
            tenantId,
            projectId,
            'projections',
            registry,
            'registry.json'
        );

        return {
            registry,
            registryUri: registryResult.uri,
        };
    }

    public async loadRegistry(tenantId: string, projectId: string): Promise<ProjectionRegistryDocument> {
        const key = this.r2StorageService.getS3Key(tenantId, projectId, 'projections', 'registry.json');

        try {
            const content = await this.r2StorageService.getFileContent(key);
            const parsed = JSON.parse(content) as ProjectionRegistryDocument;
            return {
                version: 1,
                updatedAt: parsed.updatedAt || new Date().toISOString(),
                lastRequestId: parsed.lastRequestId || '',
                projections: parsed.projections || {},
            };
        } catch {
            return {
                version: 1,
                updatedAt: new Date().toISOString(),
                lastRequestId: '',
                projections: {},
            };
        }
    }

    private findInvalidation(projectionSpec: ParrotProjectionSpec, invalidationHints: ParrotInvalidationHint[]): ParrotInvalidationHint | undefined {
        return invalidationHints.find((hint) => (
            hint.targetId === projectionSpec.projectionId
            || hint.targetId === projectionSpec.sourceId
            || hint.sourceId === projectionSpec.sourceId
        ) && (
            hint.invalidates.includes('projection')
            || hint.scope === 'projection'
            || hint.scope === 'source'
        ));
    }

    private statusForInvalidation(invalidation: ParrotInvalidationHint): ParrotArtifactStatus {
        if (invalidation.severity === 'critical') return 'invalidated';
        return 'stale';
    }
}
