import { OrchestrationService } from './OrchestrationService';
import { SourceRepository } from '../../infrastructure/repositories/SourceRepository';

export class RuntimeOrchestratorService {
    private orchestrationService: OrchestrationService;
    private sourceRepo: SourceRepository;

    constructor(orchestrationService: OrchestrationService, sourceRepo: SourceRepository) {
        this.orchestrationService = orchestrationService;
        this.sourceRepo = sourceRepo;
    }

    /**
     * Triggered by Meltano/Airbyte webhook when a new batch of data has arrived.
     * Loads persisted sources for the project and re-runs the Parrot runtime.
     *
     * @param s3Path The specific path that was just ingested (informational, usable for partial reruns later).
     */
    public async handleIngestionComplete(tenantId: string, projectId: string, s3Path: string) {
        console.log(`[ParrotRuntime] Ingestion Complete for ${projectId} at ${s3Path}`);

        const sources = await this.sourceRepo.findAllForProject(tenantId, projectId);

        if (sources.length === 0) {
            console.warn(`[ParrotRuntime] No persisted sources found for project ${projectId}. Using s3Path as fallback.`);
            this.orchestrationService.runRuntime(tenantId, projectId, [s3Path])
                .catch(err => {
                    console.error(`[ParrotRuntime] Fatal error running runtime for ${projectId}:`, err);
                });

            return { status: 'acknowledged', nextAction: 'Triggering Parrot runtime with webhook s3Path (no persisted sources)' };
        }

        const rawSourceUris = sources.map(s => s.uri);
        const sourceDescriptors = sources.map((source) => ({
            sourceId: source.sourceId,
            sourceName: source.name,
            uri: source.uri,
            type: source.type,
            connectorId: source.connectorId,
            storageConfig: source.storageConfig,
            dataCursor: source.dataCursor,
            observedMetrics: source.observedMetrics
        }));
        console.log(`[ParrotRuntime] Loaded ${rawSourceUris.length} persisted source(s) for ${projectId}`);

        this.orchestrationService.runRuntime(tenantId, projectId, rawSourceUris, sources.map(s => s.name), sourceDescriptors, true)
            .catch(err => {
                console.error(`[ParrotRuntime] Fatal error running runtime for ${projectId}:`, err);
            });

        for (const source of sources) {
            await this.sourceRepo.updateLastRunAt(tenantId, projectId, source.sourceId);
        }

        return {
            status: 'acknowledged',
            nextAction: 'Triggering full Parrot runtime',
            sourcesLoaded: rawSourceUris.length
        };
    }
}
