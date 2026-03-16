import { ProjectRepository } from '../../infrastructure/repositories/ProjectRepository';
import { SSEManager } from '../../services/sse/SSEManager';

import { PipelineRunner } from '../pipeline/PipelineRunner';
import { MLPathRunner } from '../pipeline/MLPathRunner';
import { PipelineContext, PipelineResult } from '../pipeline/types';
import { SchemaFingerprint, SourceSchema } from '../pipeline/SchemaFingerprint';
import { PipelineConfig } from '../pipeline/PipelineConfig';

/**
 * OrchestrationService is the entrypoint for the Multi-Agent execution DAG.
 * It delegates to specific PipelinePath runners (Hot/Cold/ML) based on project state.
 */
export class OrchestrationService {
    private pipelineRunner: PipelineRunner;
    private mlPathRunner: MLPathRunner;
    private projectRepo: ProjectRepository;
    private sseManager: SSEManager;

    constructor(
        pipelineRunner: PipelineRunner,
        mlPathRunner: MLPathRunner,
        projectRepo: ProjectRepository,
        sseManager: SSEManager
    ) {
        this.pipelineRunner = pipelineRunner;
        this.mlPathRunner = mlPathRunner;
        this.projectRepo = projectRepo;
        this.sseManager = sseManager;
    }

    /** 
     * Initiates the End-to-End full pipeline for a project based on newly connected data sources.
     * @param sourceNames Optional array of source identifiers (e.g. ['ga4', 'shopify']) matching rawSourceUris order.
     *                    When provided, bronze/silver paths are partitioned by source name and date.
     */
    public async runFullPipeline(tenantId: string, projectId: string, rawSourceUris: string[], sourceNames?: string[], forceRediscover: boolean = false): Promise<void> {
        console.log(`[Orchestrator] Starting Pipeline for Project ${projectId}`);

        const ctx: PipelineContext = {
            tenantId,
            projectId,
            rawSourceUris,
            sourceNames: sourceNames || [],
            forceRediscover
        };

        const project = await this.projectRepo.findById(tenantId, projectId);
        if (!project) {
            console.error(`[Orchestrator] Project ${projectId} not found.`);
            return;
        }

        // Ideally we'd have a lightweight way to get current schemas here before resolving path, 
        // but for now we assume pathResolver checks cache existence.
        // In a real scenario we'd query the DB or sample the bronze files for schemas.
        const dummyCurrentSchemas: SourceSchema[] = [];

        try {
            // --- PHASE 1: ETL EXECUTION (Unified Smart Runner) ---
            const etlResult = await this.pipelineRunner.execute(ctx);

            // Save basic ETL results immediately (Dashboards v1)
            await this.savePipelineResult(project, etlResult);
            console.log(`[Orchestrator] ETL Phase Completed for ${projectId}. Dashboards operational.`);

            // --- PHASE 2: ML ENRICHMENT (Follow-up) ---
            if (PipelineConfig.ENABLE_ML_PATH) {
                console.log(`[Orchestrator] Triggering ML Path Enrichment for ${projectId}...`);
                try {
                    // Enrich context with ETL discovery for ML optimization (scaffolds)
                    ctx.discovery = etlResult.discovery;
                    
                    const mlResult = await this.mlPathRunner.execute(ctx);
                    
                    // --- SAFE DISCOVERY MERGE ---
                    // We preserve everything from ETL and only ADD ML insights.
                    const mergedDiscovery = {
                        ...etlResult.discovery,
                        predictionModels: [
                            ...(etlResult.discovery.predictionModels || []),
                            ...(mlResult.discovery.predictionModels || [])
                        ],
                        // ML V2 Dashboards/Groups are additive to ETL ones
                        dashboardGroups: [
                            ...(etlResult.discovery.dashboardGroups || []),
                            ...(mlResult.discovery.dashboardGroups || [])
                        ],
                        dashboards: [
                            ...(etlResult.discovery.dashboards || []),
                            ...(mlResult.discovery.dashboards || [])
                        ],
                        sourceClassifications: [
                            ...(etlResult.discovery.sourceClassifications || []),
                            ...(mlResult.discovery.sourceClassifications || [])
                        ]
                    };
                    mlResult.discovery = mergedDiscovery as any;

                    await this.savePipelineResult(project, mlResult);
                    console.log(`[Orchestrator] ML Phase Completed for ${projectId}. Dashboards enhanced.`);
                } catch (mlErr: any) {
                    console.error(`[Orchestrator] ML enrichment failed, but ETL remains valid: ${mlErr.message}`);
                    // We don't fail the whole pipeline if ML fails
                    this.sseManager.broadcastToTenant(tenantId, 'pipeline_progress', {
                        step: 'ML Enrichment Warning',
                        progress: 100,
                        status: 'warning',
                        message: `ML Enrichment failed: ${mlErr.message}`
                    });
                }
            }

            // --- PHASE 3: FINALIZATION ---
            // Update the project's schema fingerprint so next run knows what's already processed
            const currentFingerprint = SchemaFingerprint.compute(dummyCurrentSchemas);
            project.schemaFingerprint = currentFingerprint;
            await this.projectRepo.createOrUpdate(project);

            console.log(`[Orchestrator] Pipeline ${projectId} Fully Operational.`);
        } catch (error: any) {
            console.error(`[Orchestrator] Pipeline execution failed: ${error.message}`);
            this.sseManager.broadcastToTenant(tenantId, 'pipeline_progress', {
                step: 'Error',
                progress: 0,
                status: 'error',
                message: error.message
            });
            throw error;
        }
    }

    private async savePipelineResult(project: any, result: PipelineResult) {
        // Build queryConfigs from dashboards discovery
        const dashboardInsights = result.discovery.dashboards || [];
        project.queryConfigs = dashboardInsights
            .map((db: any) => ({
                widgetId: db.id,
                sqlString: db.query
            }))
            .filter((q: any) => q.widgetId && q.sqlString);

        // Update Project Entity with discovery metadata
        project.discoveryMetadata = result.discovery;
        project.status = 'active';

        // Save execution telemetry / vitals
        project.pipelineVitals = project.pipelineVitals || { runsThisMonth: 0, estimatedTokensUsed: 0 };
        project.pipelineVitals.lastRunAt = result.vitals.completedAt;
        project.pipelineVitals.lastRunDurationMs = result.vitals.pipelineLatencyMs;
        project.pipelineVitals.lastPathUsed = result.vitals.pathUsed;
        project.pipelineVitals.cacheHitRate = result.vitals.cacheHitRate;
        project.pipelineVitals.runsThisMonth += 1;
        project.pipelineVitals.estimatedTokensUsed += result.vitals.estimatedTokensUsed;

        // Save discovery source classifications if any
        if (result.discovery.sourceClassifications) {
            project.sourceClassifications = result.discovery.sourceClassifications;
        }

        await this.projectRepo.createOrUpdate(project);
    }
}

