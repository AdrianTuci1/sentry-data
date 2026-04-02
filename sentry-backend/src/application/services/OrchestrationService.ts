import { ProjectRepository } from '../../infrastructure/repositories/ProjectRepository';
import { SSEManager } from '../../services/sse/SSEManager';
import { RuntimeContext, RuntimeVitals } from '../../types/runtime';
import { ParrotRuntimeService } from './ParrotRuntimeService';
import { BronzeDiscoveryService } from './BronzeDiscoveryService';
import { MindMapManifestService } from './MindMapManifestService';
import { ParrotProgressService } from './ParrotProgressService';
import { WorkloadPlannerService } from './WorkloadPlannerService';
import { ExecutionPlaneService } from './ExecutionPlaneService';

/**
 * OrchestrationService is the entrypoint for the Parrot OS runtime.
 * It coordinates discovery, decisioning, and mindmap generation without a DAG runner.
 */
export class OrchestrationService {
    private projectRepo: ProjectRepository;
    private sseManager: SSEManager;
    private parrotRuntimeService: ParrotRuntimeService;
    private bronzeDiscoveryService: BronzeDiscoveryService;
    private mindMapManifestService: MindMapManifestService;
    private parrotProgressService: ParrotProgressService;
    private workloadPlannerService: WorkloadPlannerService;
    private executionPlaneService: ExecutionPlaneService;

    constructor(
        projectRepo: ProjectRepository,
        sseManager: SSEManager,
        parrotRuntimeService: ParrotRuntimeService,
        bronzeDiscoveryService: BronzeDiscoveryService,
        mindMapManifestService: MindMapManifestService,
        parrotProgressService: ParrotProgressService,
        workloadPlannerService: WorkloadPlannerService,
        executionPlaneService: ExecutionPlaneService
    ) {
        this.projectRepo = projectRepo;
        this.sseManager = sseManager;
        this.parrotRuntimeService = parrotRuntimeService;
        this.bronzeDiscoveryService = bronzeDiscoveryService;
        this.mindMapManifestService = mindMapManifestService;
        this.parrotProgressService = parrotProgressService;
        this.workloadPlannerService = workloadPlannerService;
        this.executionPlaneService = executionPlaneService;
    }

    /**
     * Initiates the end-to-end runtime for a project based on newly connected data sources.
     * @param sourceNames Optional array of source identifiers (e.g. ['ga4', 'shopify']) matching rawSourceUris order.
     *                    When provided, bronze/silver paths are partitioned by source name and date.
     */
    public async runRuntime(tenantId: string, projectId: string, rawSourceUris: string[], sourceNames?: string[], forceRediscover: boolean = false): Promise<void> {
        console.log(`[Orchestrator] Starting Parrot runtime for Project ${projectId}`);
        const startTime = Date.now();

        const ctx: RuntimeContext = {
            tenantId,
            projectId,
            rawSourceUris,
            sourceNames: sourceNames || [],
            runtimeMode: 'parrot_os',
            forceRediscover
        };

        const project = await this.projectRepo.findById(tenantId, projectId);
        if (!project) {
            console.error(`[Orchestrator] Project ${projectId} not found.`);
            return;
        }

        let parrotBootstrap = null;
        let finalDiscovery: any = null;
        let finalVitals: any = null;

        try {
            // Bootstrap runtime metadata and align the execution score through Sentinel.
            parrotBootstrap = await this.parrotRuntimeService.bootstrapRun(project, ctx);
            ctx.requestId = parrotBootstrap.requestId;
            ctx.executionScoreUri = parrotBootstrap.artifacts.executionScoreUri;
            ctx.progressFileUri = parrotBootstrap.artifacts.progressFileUri;

            await this.parrotRuntimeService.markExecutionStarted(tenantId, projectId, parrotBootstrap);

            this.sseManager.broadcastToTenant(tenantId, 'runtime_progress', {
                step: 'Bronze Discovery',
                progress: 45,
                status: 'in_progress',
                requestId: parrotBootstrap.requestId
            });

            const sourceProfiles = await this.bronzeDiscoveryService.discoverSources(ctx);

            this.sseManager.broadcastToTenant(tenantId, 'runtime_progress', {
                step: 'Workload Planning',
                progress: 60,
                status: 'in_progress',
                requestId: parrotBootstrap.requestId
            });

            const executionPlan = this.workloadPlannerService.buildPlan(
                parrotBootstrap.requestId,
                parrotBootstrap.executionScore,
                sourceProfiles
            );
            await this.parrotProgressService.saveExecutionPlan(
                tenantId,
                projectId,
                parrotBootstrap.requestId,
                executionPlan
            );

            const executionSubmission = await this.executionPlaneService.submitPlan(
                tenantId,
                projectId,
                parrotBootstrap.requestId,
                executionPlan,
                parrotBootstrap.artifacts.executionScoreUri
            );
            await this.parrotProgressService.saveExecutionSubmission(
                tenantId,
                projectId,
                parrotBootstrap.requestId,
                executionSubmission
            );

            const mindMapPackage = this.mindMapManifestService.build(sourceProfiles, parrotBootstrap.reverseEtl, executionPlan);
            const { uri: mindmapYamlUri } = await this.parrotProgressService.saveMindMapYaml(
                tenantId,
                projectId,
                parrotBootstrap.requestId,
                mindMapPackage.yaml
            );

            finalDiscovery = {
                ...mindMapPackage.projection,
                mindmapManifest: mindMapPackage.manifest,
                mindmapYaml: mindMapPackage.yaml,
                sourceMetadata: sourceProfiles,
                executionPlan,
                executionSubmission,
                metadataArtifacts: {
                    requestId: parrotBootstrap.requestId,
                    executionScoreUri: parrotBootstrap.artifacts.executionScoreUri,
                    progressFileUri: parrotBootstrap.artifacts.progressFileUri,
                    sentinelReportUri: parrotBootstrap.artifacts.sentinelReportUri,
                    mindmapYamlUri,
                    executionPlanUri: parrotBootstrap.artifacts.executionPlanUri,
                    executionSubmissionUri: parrotBootstrap.artifacts.executionSubmissionUri
                }
            };

            finalVitals = {
                runtimeLatencyMs: Date.now() - startTime,
                pathUsed: 'parrot_os',
                cacheHitRate: 0,
                estimatedTokensUsed: 0,
                tasksExecuted: ['bronze_discovery', 'workload_planning', 'execution_submission', 'mindmap_generation', 'recommendation_staging'],
                startedAt: new Date(startTime).toISOString(),
                completedAt: new Date().toISOString()
            } satisfies RuntimeVitals;

            await this.saveProjectDiscovery(tenantId, projectId, finalDiscovery, finalVitals);

            const finalProject = await this.projectRepo.findById(tenantId, projectId);
            if (finalProject) {
                const currentFingerprint = parrotBootstrap?.executionScore.metadata.source_fingerprint;
                finalProject.schemaFingerprint = currentFingerprint;
                finalProject.runtimeMode = 'parrot_os';
                finalProject.parrotRuntime = {
                    ...(finalProject.parrotRuntime || { mode: 'parrot_os' }),
                    sourceMetadataUris: sourceProfiles.map((profile) => profile.metadataUri || '').filter(Boolean),
                    mindmapYamlUri,
                    executionPlanUri: parrotBootstrap.artifacts.executionPlanUri,
                    executionSubmissionUri: parrotBootstrap.artifacts.executionSubmissionUri,
                    executionEngine: executionPlan.engine,
                    executionStatus: executionSubmission.status
                };
                await this.projectRepo.createOrUpdate(finalProject);
            }

            if (parrotBootstrap && finalDiscovery) {
                await this.parrotRuntimeService.completeRun(
                    tenantId,
                    projectId,
                    parrotBootstrap,
                    finalDiscovery,
                    finalVitals
                );
            }

            console.log(`[Orchestrator] Parrot runtime ${projectId} Fully Operational.`);
        } catch (error: any) {
            console.error(`[Orchestrator] Parrot runtime execution failed: ${error.message}`);
            await this.parrotRuntimeService.failRun(tenantId, projectId, parrotBootstrap, error);
            this.sseManager.broadcastToTenant(tenantId, 'runtime_progress', {
                step: 'Error',
                progress: 0,
                status: 'error',
                message: error.message
            });
            throw error;
        }
    }

    public async saveProjectDiscovery(tenantId: string, projectId: string, discovery: any, vitals?: RuntimeVitals) {
        // Force reading from DynamoDB to get the absolute latest state (avoid overwriting concurrent changes)
        const project = await this.projectRepo.findById(tenantId, projectId);
        if (!project) {
            console.error(`[Orchestrator] Cannot save results: Project ${projectId} not found.`);
            return;
        }

        // Build queryConfigs from insights discovery
        const insights = discovery.insight || [];
        project.queryConfigs = insights
            .map((db: any) => ({
                widgetId: db.id,
                sqlString: db.query || db.sql
            }))
            .filter((q: any) => q.widgetId && q.sqlString);

        // Update Project Entity with discovery metadata
        project.discoveryMetadata = discovery;
        project.status = 'active';

        // Save execution telemetry / vitals if provided
        if (vitals) {
            project.runtimeVitals = project.runtimeVitals || { runsThisMonth: 0, estimatedTokensUsed: 0 };
            project.runtimeVitals.lastRunAt = vitals.completedAt;
            project.runtimeVitals.lastRunDurationMs = vitals.runtimeLatencyMs;
            project.runtimeVitals.lastPathUsed = vitals.pathUsed;
            project.runtimeVitals.cacheHitRate = vitals.cacheHitRate;
            project.runtimeVitals.runsThisMonth += 1;
            project.runtimeVitals.estimatedTokensUsed += vitals.estimatedTokensUsed;
        }

        // Save discovery source classifications if any
        if (discovery.sourceClassifications) {
            project.sourceClassifications = discovery.sourceClassifications;
        }

        await this.projectRepo.createOrUpdate(project);

        // Broadcast SSE notification (without payload — frontend fetches from DB)
        this.sseManager.broadcastToTenant(project.tenantId, 'discovery_updated', {
            projectId: project.projectId
        });
    }
}
