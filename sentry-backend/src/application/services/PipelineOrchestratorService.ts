import { OrchestrationService } from './OrchestrationService';

export class PipelineOrchestratorService {
    private orchestrationService: OrchestrationService;

    constructor(orchestrationService: OrchestrationService) {
        this.orchestrationService = orchestrationService;
    }

    /**
     * Triggered by Meltano when a new batch of data has arrived in the Bronze Layer.
     */
    public async handleIngestionComplete(tenantId: string, projectId: string, s3Path: string) {
        console.log(`[Pipeline] Ingestion Complete for ${projectId} at ${s3Path}`);

        // Trigger the full multi-agent DAG
        this.orchestrationService.runFullPipeline(tenantId, projectId, [s3Path])
            .catch(err => {
                console.error(`[Pipeline] Fatal error running Orchestration for ${projectId}:`, err);
            });

        return { status: 'acknowledged', nextAction: 'Triggering Full Orchestration Pipeline' };
    }
}
