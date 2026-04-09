import { R2StorageService } from '../../infrastructure/storage/R2StorageService';
import { ParrotSourceProfile } from '../../types/parrot';

interface ProjectionRegistryEntry {
    projectionId: string;
    title: string;
    sourceId: string;
    sourceName: string;
    latestVersion: string;
    latestUri: string;
    columns: string[];
    versions: Array<{
        version: string;
        uri: string;
        createdAt: string;
    }>;
}

interface ProjectionRegistryDocument {
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
        const registry = await this.loadExistingRegistry(tenantId, projectId);
        registry.updatedAt = new Date().toISOString();
        registry.lastRequestId = requestId;

        for (const profile of sourceProfiles) {
            for (const goldView of profile.goldViews) {
                const manifest = {
                    projectionId: goldView.id,
                    title: goldView.title,
                    sourceId: profile.sourceId,
                    sourceName: profile.sourceName,
                    version: requestId,
                    createdAt: registry.updatedAt,
                    uri: profile.uri,
                    logic: goldView.logic,
                    columns: goldView.columns,
                };

                const result = await this.r2StorageService.saveJson(
                    tenantId,
                    projectId,
                    'projections',
                    manifest,
                    goldView.id,
                    'versions',
                    requestId,
                    'manifest.json'
                );

                goldView.projectionVersion = requestId;
                goldView.projectionUri = result.uri;

                const existing = registry.projections[goldView.id];
                const nextVersions = existing?.versions || [];
                if (!nextVersions.some((entry) => entry.version === requestId)) {
                    nextVersions.push({
                        version: requestId,
                        uri: result.uri,
                        createdAt: registry.updatedAt,
                    });
                }

                registry.projections[goldView.id] = {
                    projectionId: goldView.id,
                    title: goldView.title,
                    sourceId: profile.sourceId,
                    sourceName: profile.sourceName,
                    latestVersion: requestId,
                    latestUri: result.uri,
                    columns: goldView.columns.map((column) => column.name),
                    versions: nextVersions
                        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
                        .slice(-20),
                };
            }
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

    private async loadExistingRegistry(tenantId: string, projectId: string): Promise<ProjectionRegistryDocument> {
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
}
