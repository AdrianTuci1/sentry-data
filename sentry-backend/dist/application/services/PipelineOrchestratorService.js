"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipelineOrchestratorService = void 0;
class PipelineOrchestratorService {
    constructor(sandboxProvider, r2StorageService, agentService) {
        this.sandboxProvider = sandboxProvider;
        this.r2StorageService = r2StorageService;
        this.agentService = agentService;
    }
    /**
     * Triggered by Meltano when a new batch of data has arrived in the Bronze Layer.
     */
    async handleIngestionComplete(tenantId, projectId, s3Path) {
        console.log(`[Pipeline] Ingestion Complete for ${projectId} at ${s3Path}`);
        console.log(`[Pipeline] Using Storage Backend via Config... generating URI...`);
        const readUri = this.r2StorageService.getS3Uri(tenantId, projectId, 'bronze', 'data.parquet');
        console.log(`[Pipeline] Triggering Sandbox Provider for AI Schema Mapping...`);
        // Asynchronously trigger the agent to analyze the newly ingested Bronze data
        // and create the Gold aggregation queries.
        // We don't await this so the Webhook HTTP response returns quickly to Meltano.
        this.agentService.runDataProfilerAgent(tenantId, projectId, readUri)
            .catch(err => {
            console.error(`[Pipeline] Fatal error running Agent for ${projectId}:`, err);
        });
        return { status: 'acknowledged', nextAction: 'Triggering AI Agent Profiling' };
    }
}
exports.PipelineOrchestratorService = PipelineOrchestratorService;
