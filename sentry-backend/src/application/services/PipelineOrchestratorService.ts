import { OrchestrationService } from './OrchestrationService';
import { SourceRepository } from '../../infrastructure/repositories/SourceRepository';

export class PipelineOrchestratorService {
    private orchestrationService: OrchestrationService;
    private sourceRepo: SourceRepository;

    constructor(orchestrationService: OrchestrationService, sourceRepo: SourceRepository) {
        this.orchestrationService = orchestrationService;
        this.sourceRepo = sourceRepo;
    }

    /**
     * Triggered by Meltano/Airbyte webhook when a new batch of data has arrived.
     * Loads persisted sources for the project and re-runs pipeline (with cache-hit on existing scripts).
     *
     * @param s3Path - The specific path that was just ingested (informational / can be used for partial re-run)
     */
    public async handleIngestionComplete(tenantId: string, projectId: string, s3Path: string) {
        console.log(`[Pipeline] Ingestion Complete for ${projectId} at ${s3Path}`);

        // 1. Load all persisted sources for this project
        const sources = await this.sourceRepo.findAllForProject(tenantId, projectId);

        if (sources.length === 0) {
            console.warn(`[Pipeline] No persisted sources found for project ${projectId}. Using s3Path as fallback.`);
            // Fallback: use the s3Path from the webhook directly
            this.orchestrationService.runFullPipeline(tenantId, projectId, [s3Path])
                .catch(err => {
                    console.error(`[Pipeline] Fatal error running Orchestration for ${projectId}:`, err);
                });

            return { status: 'acknowledged', nextAction: 'Triggering pipeline with webhook s3Path (no persisted sources)' };
        }

        const rawSourceUris = sources.map(s => s.uri);
        console.log(`[Pipeline] Loaded ${rawSourceUris.length} persisted source(s) for ${projectId}`);

        // 2. Trigger the full multi-agent DAG
        this.orchestrationService.runFullPipeline(tenantId, projectId, rawSourceUris, sources.map(s => s.sourceType))
            .catch(err => {
                console.error(`[Pipeline] Fatal error running Orchestration for ${projectId}:`, err);
            });

        // 3. Update lastRunAt on all sources
        for (const source of sources) {
            await this.sourceRepo.updateLastRunAt(tenantId, projectId, source.sourceId);
        }

        return {
            status: 'acknowledged',
            nextAction: 'Triggering Full Orchestration Pipeline (cache-hit on existing scripts)',
            sourcesLoaded: rawSourceUris.length
        };
    }
}
