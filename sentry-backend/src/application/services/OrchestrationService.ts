import { ProjectRepository } from '../../infrastructure/repositories/ProjectRepository';
import { SSEManager } from '../../services/sse/SSEManager';

import { PathResolver } from '../pipeline/PathResolver';
import { HotPathRunner } from '../pipeline/HotPathRunner';
import { ColdPathRunner } from '../pipeline/ColdPathRunner';
import { MLPathRunner } from '../pipeline/MLPathRunner';
import { PipelineContext, PipelineResult } from '../pipeline/types';
import { SourceSchema } from '../pipeline/SchemaFingerprint';

/**
 * OrchestrationService is the entrypoint for the Multi-Agent execution DAG.
 * It delegates to specific PipelinePath runners (Hot/Cold/ML) based on project state.
 */
export class OrchestrationService {
    private pathResolver: PathResolver;
    private hotPathRunner: HotPathRunner;
    private coldPathRunner: ColdPathRunner;
    private mlPathRunner: MLPathRunner;
    private projectRepo: ProjectRepository;
    private sseManager: SSEManager;

    constructor(
        pathResolver: PathResolver,
        hotPathRunner: HotPathRunner,
        coldPathRunner: ColdPathRunner,
        mlPathRunner: MLPathRunner,
        projectRepo: ProjectRepository,
        sseManager: SSEManager
    ) {
        this.pathResolver = pathResolver;
        this.hotPathRunner = hotPathRunner;
        this.coldPathRunner = coldPathRunner;
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
            // Determine the execution path and granular invalidations
            const resolution = await this.pathResolver.resolve(ctx, dummyCurrentSchemas, project.schemaFingerprint);
            
            // Inject invalidated sources into the context so ColdPathRunner knows what to regenerate
            ctx.invalidatedSources = resolution.invalidatedSources;

            console.log(`[Orchestrator] Execution Path: ${resolution.path}, Invalidated Sources: ${resolution.invalidatedSources.join(', ') || 'None'}`);

            // Execute the appropriate runner
            let result: PipelineResult;
            switch (resolution.path) {
                case 'hot':
                    result = await this.hotPathRunner.execute(ctx);
                    break;
                case 'cold':
                    result = await this.coldPathRunner.execute(ctx);
                    break;
                case 'ml':
                    result = await this.mlPathRunner.execute(ctx);
                    break;
                default:
                    throw new Error(`Unknown pipeline path: ${resolution.path}`);
            }

            // Save results and telemetry
            await this.savePipelineResult(project, result);

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

