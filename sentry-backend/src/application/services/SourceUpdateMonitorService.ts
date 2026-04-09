import { OrchestrationService } from './OrchestrationService';
import { ObjectStorageService } from './ObjectStorageService';
import { SourceEntity, SourceRepository } from '../../infrastructure/repositories/SourceRepository';
import { RuntimeSourceDescriptor } from '../../types/runtime';

export interface ProjectSourceScanResult {
    projectId: string;
    changedSourceIds: string[];
    skippedSourceIds: string[];
    inspectedSources: number;
    triggeredRuntime: boolean;
}

export class SourceUpdateMonitorService {
    constructor(
        private readonly sourceRepo: SourceRepository,
        private readonly objectStorageService: ObjectStorageService,
        private readonly orchestrationService: OrchestrationService
    ) {}

    public async scanProjectSources(tenantId: string, projectId: string): Promise<ProjectSourceScanResult> {
        const sources = await this.sourceRepo.findAllForProject(tenantId, projectId);
        if (sources.length === 0) {
            return {
                projectId,
                changedSourceIds: [],
                skippedSourceIds: [],
                inspectedSources: 0,
                triggeredRuntime: false,
            };
        }

        const changedSourceIds: string[] = [];
        const skippedSourceIds: string[] = [];
        const sourceDescriptors: RuntimeSourceDescriptor[] = [];

        for (const source of sources) {
            if (!source.uri.startsWith('s3://') && !source.storageConfig) {
                skippedSourceIds.push(source.sourceId);
                sourceDescriptors.push(this.toDescriptor(source));
                continue;
            }

            try {
                const inspection = await this.objectStorageService.inspectSource(source);
                const changed = !source.dataCursor || source.dataCursor.fingerprint !== inspection.cursor.fingerprint;

                source.dataCursor = inspection.cursor;
                source.observedMetrics = {
                    ...(source.observedMetrics || {}),
                    ...inspection.metrics,
                };
                source.lastObservedAt = inspection.cursor.scannedAt;
                await this.sourceRepo.createOrUpdate(source);

                if (changed) {
                    changedSourceIds.push(source.sourceId);
                }
            } catch (error) {
                console.warn(`[SourceUpdateMonitor] Failed to inspect source ${source.sourceId}:`, error);
                skippedSourceIds.push(source.sourceId);
            }

            sourceDescriptors.push(this.toDescriptor(source));
        }

        if (changedSourceIds.length > 0) {
            await this.orchestrationService.runRuntime(
                tenantId,
                projectId,
                sourceDescriptors.map((source) => source.uri),
                sourceDescriptors.map((source) => source.sourceName),
                sourceDescriptors,
                true,
                changedSourceIds
            );
        }

        return {
            projectId,
            changedSourceIds,
            skippedSourceIds,
            inspectedSources: sources.length,
            triggeredRuntime: changedSourceIds.length > 0,
        };
    }

    public async scanTenantSources(tenantId: string): Promise<ProjectSourceScanResult[]> {
        const sources = await this.sourceRepo.findAllForTenant(tenantId);
        const projectIds = [...new Set(sources.map((source) => source.projectId))];

        const results: ProjectSourceScanResult[] = [];
        for (const projectId of projectIds) {
            results.push(await this.scanProjectSources(tenantId, projectId));
        }

        return results;
    }

    private toDescriptor(source: SourceEntity): RuntimeSourceDescriptor {
        return {
            sourceId: source.sourceId,
            sourceName: source.name,
            uri: source.uri,
            type: source.type,
            connectorId: source.connectorId,
            storageConfig: source.storageConfig,
            dataCursor: source.dataCursor,
            observedMetrics: source.observedMetrics,
        };
    }
}
