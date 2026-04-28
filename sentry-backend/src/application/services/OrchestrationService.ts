import { ProjectRepository } from '../../infrastructure/repositories/ProjectRepository';
import { SSEManager } from '../../services/sse/SSEManager';
import { ParrotProjectionPlan, ParrotQuerySpec, ParrotSentinelModelSignal } from '../../types/parrot';
import { RuntimeContext, RuntimeVitals } from '../../types/runtime';
import { ParrotRuntimeService } from './ParrotRuntimeService';
import { BronzeDiscoveryService } from './BronzeDiscoveryService';
import { MindMapManifestService } from './MindMapManifestService';
import { ParrotProgressService } from './ParrotProgressService';
import { WorkloadPlannerService } from './WorkloadPlannerService';
import { ExecutionPlaneService } from './ExecutionPlaneService';
import { ProjectionRegistryService } from './ProjectionRegistryService';
import { QueryRegistryService } from './QueryRegistryService';
import { SentinelFeedbackService } from './SentinelFeedbackService';

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
    private projectionRegistryService: ProjectionRegistryService;
    private queryRegistryService: QueryRegistryService;
    private sentinelFeedbackService: SentinelFeedbackService;

    constructor(
        projectRepo: ProjectRepository,
        sseManager: SSEManager,
        parrotRuntimeService: ParrotRuntimeService,
        bronzeDiscoveryService: BronzeDiscoveryService,
        mindMapManifestService: MindMapManifestService,
        parrotProgressService: ParrotProgressService,
        workloadPlannerService: WorkloadPlannerService,
        executionPlaneService: ExecutionPlaneService,
        projectionRegistryService: ProjectionRegistryService,
        queryRegistryService: QueryRegistryService,
        sentinelFeedbackService: SentinelFeedbackService
    ) {
        this.projectRepo = projectRepo;
        this.sseManager = sseManager;
        this.parrotRuntimeService = parrotRuntimeService;
        this.bronzeDiscoveryService = bronzeDiscoveryService;
        this.mindMapManifestService = mindMapManifestService;
        this.parrotProgressService = parrotProgressService;
        this.workloadPlannerService = workloadPlannerService;
        this.executionPlaneService = executionPlaneService;
        this.projectionRegistryService = projectionRegistryService;
        this.queryRegistryService = queryRegistryService;
        this.sentinelFeedbackService = sentinelFeedbackService;
    }

    /**
     * Initiates the end-to-end runtime for a project based on newly connected data sources.
     * @param sourceNames Optional array of source identifiers (e.g. ['ga4', 'shopify']) matching rawSourceUris order.
     *                    When provided, bronze/silver paths are partitioned by source name and date.
     */
    public async runRuntime(
        tenantId: string,
        projectId: string,
        rawSourceUris: string[],
        sourceNames?: string[],
        sourceDescriptors?: RuntimeContext['sourceDescriptors'],
        forceRediscover: boolean = false,
        invalidatedSources: string[] = []
    ): Promise<void> {
        console.log(`[Orchestrator] Starting Parrot runtime for Project ${projectId}`);
        const startTime = Date.now();

        const ctx: RuntimeContext = {
            tenantId,
            projectId,
            rawSourceUris,
            sourceNames: sourceNames || [],
            sourceDescriptors,
            runtimeMode: 'parrot_os',
            forceRediscover,
            invalidatedSources
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
            this.emitRuntimeMindmapPartial(tenantId, parrotBootstrap.requestId, 'bronze_discovery', {
                ...this.buildRuntimeMindmapPatch(sourceProfiles),
                sourceMetadata: sourceProfiles
            });

            const previousProjectionRegistry = await this.projectionRegistryService.loadRegistry(tenantId, projectId);
            const previousQueryRegistry = await this.queryRegistryService.loadRegistry(tenantId, projectId);
            const sentinelPolicyState = await this.sentinelFeedbackService.loadPolicyState(tenantId, projectId);
            const initialInvalidationHints = await this.parrotRuntimeService.buildRuntimeInvalidationHints(
                tenantId,
                projectId,
                sourceProfiles,
                previousProjectionRegistry,
                invalidatedSources,
                [],
                [],
                sentinelPolicyState
            );
            this.emitRuntimeMindmapPartial(tenantId, parrotBootstrap.requestId, 'sentinel_invalidation', {
                invalidationHints: initialInvalidationHints,
                sentinelModelSignals: this.parrotRuntimeService.getLastSentinelModelSignals()
            });

            this.sseManager.broadcastToTenant(tenantId, 'runtime_progress', {
                step: 'Projection Planning',
                progress: 52,
                status: 'in_progress',
                requestId: parrotBootstrap.requestId,
                invalidationHints: initialInvalidationHints.length
            });

            const compiledAt = new Date().toISOString();
            const projectionPlan = await this.parrotRuntimeService.compileProjectionPlan({
                tenantId,
                projectId,
                requestId: parrotBootstrap.requestId,
                sourceProfiles,
                previousProjectionRegistry,
                previousQueryRegistry,
                invalidationHints: initialInvalidationHints,
                sentinelPolicyState,
                activeProjectionVersions: Object.fromEntries(
                    Object.entries(previousProjectionRegistry.projections).map(([projectionId, entry]) => [projectionId, entry.latestVersion])
                ),
                widgetCatalogVersion: 'runtime-widget-catalog-v1',
                forceRediscover,
                invalidatedSources,
                compiledAt
            });

            const fullInvalidationHints = await this.parrotRuntimeService.buildRuntimeInvalidationHints(
                tenantId,
                projectId,
                sourceProfiles,
                previousProjectionRegistry,
                invalidatedSources,
                projectionPlan.querySpecs,
                projectionPlan.mlRecommendations,
                sentinelPolicyState
            );
            projectionPlan.invalidationHints = fullInvalidationHints;
            projectionPlan.sentinelModelSignals = this.parrotRuntimeService.getLastSentinelModelSignals();
            this.applySentinelBusinessRelevanceFilter(projectionPlan);
            this.emitRuntimeMindmapPartial(tenantId, parrotBootstrap.requestId, 'projection_plan', {
                ...this.buildRuntimeMindmapPatch(sourceProfiles, projectionPlan),
                projectionPlanPreview: {
                    projectionCount: projectionPlan.projectionSpecs.length,
                    queryCount: projectionPlan.querySpecs.length,
                    mlRecommendationCount: projectionPlan.mlRecommendations.length,
                    invalidationHintCount: projectionPlan.invalidationHints.length
                },
                projectionSpecs: projectionPlan.projectionSpecs,
                querySpecs: projectionPlan.querySpecs,
                mlRecommendations: projectionPlan.mlRecommendations,
                invalidationHints: projectionPlan.invalidationHints,
                sentinelModelSignals: projectionPlan.sentinelModelSignals || []
            });

            await this.parrotProgressService.saveProjectionPlan(
                tenantId,
                projectId,
                parrotBootstrap.requestId,
                projectionPlan
            );

            const projectionRegistry = await this.projectionRegistryService.registerProjectionSpecs(
                tenantId,
                projectId,
                parrotBootstrap.requestId,
                projectionPlan.projectionSpecs,
                projectionPlan.invalidationHints
            );
            const queryRegistry = await this.queryRegistryService.registerQuerySpecs(
                tenantId,
                projectId,
                parrotBootstrap.requestId,
                projectionPlan.querySpecs,
                projectionPlan.invalidationHints
            );

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

            const mindMapPackage = this.mindMapManifestService.build(sourceProfiles, parrotBootstrap.reverseEtl, executionPlan, projectionPlan);
            const { uri: mindmapYamlUri } = await this.parrotProgressService.saveMindMapYaml(
                tenantId,
                projectId,
                parrotBootstrap.requestId,
                mindMapPackage.yaml
            );
            const { uri: mindmapManifestUri } = await this.parrotProgressService.saveMindMapManifest(
                tenantId,
                projectId,
                parrotBootstrap.requestId,
                mindMapPackage.manifest
            );

            finalDiscovery = {
                ...mindMapPackage.projection,
                mindmapManifest: mindMapPackage.manifest,
                mindmapYaml: mindMapPackage.yaml,
                sourceMetadata: sourceProfiles,
                projectionPlan,
                projectionRegistry: projectionRegistry.registry,
                queryRegistry: queryRegistry.registry,
                mlRecommendations: projectionPlan.mlRecommendations,
                invalidationHints: projectionPlan.invalidationHints,
                sentinelModelSignals: projectionPlan.sentinelModelSignals || [],
                sentinelPolicyState,
                executionPlan,
                executionSubmission,
                metadataArtifacts: {
                    requestId: parrotBootstrap.requestId,
                    executionScoreUri: parrotBootstrap.artifacts.executionScoreUri,
                    progressFileUri: parrotBootstrap.artifacts.progressFileUri,
                    sentinelReportUri: parrotBootstrap.artifacts.sentinelReportUri,
                    mindmapYamlUri,
                    mindmapManifestUri,
                    executionPlanUri: parrotBootstrap.artifacts.executionPlanUri,
                    executionSubmissionUri: parrotBootstrap.artifacts.executionSubmissionUri,
                    projectionRegistryUri: projectionRegistry.registryUri,
                    queryRegistryUri: queryRegistry.registryUri,
                    projectionPlanUri: parrotBootstrap.artifacts.projectionPlanUri
                }
            };

            const cacheEligibleQueries = projectionPlan.querySpecs.filter((querySpec) => querySpec.executionPolicy.mode !== 'direct').length;
            finalVitals = {
                runtimeLatencyMs: Date.now() - startTime,
                pathUsed: 'parrot_os',
                cacheHitRate: 0,
                cacheEligibleQueryRatio: projectionPlan.querySpecs.length > 0 ? cacheEligibleQueries / projectionPlan.querySpecs.length : 0,
                estimatedTokensUsed: 0,
                tasksExecuted: [
                    'bronze_discovery',
                    'sentinel_invalidation',
                    'projection_plan_compilation',
                    'projection_registry',
                    'query_registry',
                    'workload_planning',
                    'execution_submission',
                    'mindmap_generation',
                    'recommendation_staging'
                ],
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
                    mindmapManifestUri,
                    executionPlanUri: parrotBootstrap.artifacts.executionPlanUri,
                    executionSubmissionUri: parrotBootstrap.artifacts.executionSubmissionUri,
                    projectionRegistryUri: projectionRegistry.registryUri,
                    queryRegistryUri: queryRegistry.registryUri,
                    projectionPlanUri: parrotBootstrap.artifacts.projectionPlanUri,
                    mlRecommendationCount: projectionPlan.mlRecommendations.length,
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

    private emitRuntimeMindmapPartial(tenantId: string, requestId: string, stage: string, discoveryPatch: any): void {
        this.sseManager.broadcastToTenant(tenantId, 'runtime_mindmap_partial', {
            requestId,
            stage,
            emittedAt: new Date().toISOString(),
            discoveryPatch
        });
    }

    private buildRuntimeMindmapPatch(sourceProfiles: any[], projectionPlan?: any): any {
        const isMlEligible = (profile: any) => (
            (profile.metricCandidates?.length || 0) > 0
            && (((profile.entityKeyCandidates?.length || 0) > 0) || ((profile.timestampCandidates?.length || 0) > 0))
        );
        const isReverseEtlEligible = (profile: any) => (
            (profile.metricCandidates?.length || 0) > 0
            && (profile.entityKeyCandidates?.length || 0) > 0
        );
        const dedupeStrings = (values: any[]) => Array.from(new Set((values || []).filter(Boolean)));
        const getOperationalGroupId = (sourceId: string) => `grp-${sourceId}-operational`;
        const getMlGroupId = (sourceId: string) => `grp-${sourceId}-ml-recommended`;
        const getReverseGroupId = (sourceId: string) => `grp-${sourceId}-reverse-etl-recommended`;
        const getPrimaryViewId = (profile: any) => (
            (profile.goldViews || []).find((view: any) => String(view.id || '').endsWith('-core'))?.id
            || (profile.goldViews || [])[0]?.id
        );
        const getMetricViewId = (profile: any) => (
            (profile.goldViews || []).find((view: any) => String(view.id || '').endsWith('-metrics'))?.id
            || getPrimaryViewId(profile)
        );
        const getViewColumns = (view: any) => (
            (view?.columns || []).map((column: any) => column?.name).filter(Boolean)
        );
        const resolveBestViewId = (profile: any, columns: string[] = [], preferredViewId?: string) => {
            const cleanedColumns = dedupeStrings(columns);
            const preferredView = (profile.goldViews || []).find((view: any) => view.id === preferredViewId);
            if (cleanedColumns.length === 0) {
                return preferredView?.id || getPrimaryViewId(profile);
            }

            const scoredViews = (profile.goldViews || [])
                .map((view: any) => {
                    const viewColumns = new Set(getViewColumns(view));
                    const overlapCount = cleanedColumns.filter((column) => viewColumns.has(column)).length;
                    return {
                        view,
                        overlapCount,
                        isFullMatch: cleanedColumns.every((column) => viewColumns.has(column)),
                        columnCount: viewColumns.size
                    };
                })
                .filter((entry: any) => entry.overlapCount > 0);

            const fullMatches = scoredViews
                .filter((entry: any) => entry.isFullMatch)
                .sort((left: any, right: any) => left.columnCount - right.columnCount || String(left.view.id).localeCompare(String(right.view.id)));

            if (fullMatches.length > 0) {
                if (preferredView && fullMatches.some((entry: any) => entry.view.id === preferredView.id)) {
                    return preferredView.id;
                }

                return fullMatches[0].view.id;
            }

            if (preferredView) {
                return preferredView.id;
            }

            const bestPartialMatch = scoredViews
                .sort((left: any, right: any) => right.overlapCount - left.overlapCount || left.columnCount - right.columnCount)[0];

            return bestPartialMatch?.view?.id || getPrimaryViewId(profile);
        };
        const resolveLineage = (sourceId: string | undefined, preferredViewId: string | undefined, columns: string[] = []) => {
            const cleanedColumns = dedupeStrings(columns);
            const profile = sourceProfiles.find((entry: any) => entry.sourceId === sourceId)
                || sourceProfiles.find((entry: any) => (entry.goldViews || []).some((view: any) => view.id === preferredViewId));

            if (!profile) {
                return {
                    sourceKey: preferredViewId,
                    columns: cleanedColumns
                };
            }

            const sourceKey = resolveBestViewId(profile, cleanedColumns, preferredViewId);
            const resolvedView = (profile.goldViews || []).find((view: any) => view.id === sourceKey);
            const resolvedColumns = cleanedColumns.filter((column) => getViewColumns(resolvedView).includes(column));

            return {
                sourceKey,
                columns: resolvedColumns.length > 0 ? resolvedColumns : cleanedColumns
            };
        };

        const connector = sourceProfiles.map((profile) => ({
            id: profile.sourceId,
            name: profile.sourceName,
            type: profile.sourceType,
            status: 'ok',
            uri: profile.uri,
            metricCount: profile.metricCandidates?.length || 0,
            timestampCount: profile.timestampCandidates?.length || 0
        }));

        const actionType = sourceProfiles.map((profile) => ({
            id: `action-${profile.sourceId}`,
            name: 'Virtualize',
            connector_id: profile.sourceId,
            status: 'ok'
        }));

        const adjustedData = sourceProfiles.flatMap((profile) => (profile.goldViews || []).map((goldView: any) => ({
            id: goldView.id,
            name: goldView.title,
            title: goldView.title,
            origin_id: profile.sourceId,
            action_type_id: `action-${profile.sourceId}`,
            status: 'ok',
            columns: (goldView.columns || []).map((column: any) => ({
                id: `${goldView.id}-${column.name}`,
                name: column.name,
                title: column.name,
                type: column.type,
                status: 'ok'
            }))
        })));

        const queryInsights = (projectionPlan?.querySpecs || []).map((querySpec: any) => {
            const resolvedLineage = resolveLineage(
                querySpec.sourceId,
                querySpec.projectionId,
                querySpec.dependencies?.columns || []
            );

            return {
                id: querySpec.widgetId || querySpec.queryId,
                title: querySpec.title,
                type: querySpec.widgetType,
                widget_type: querySpec.widgetType,
                group_id: getOperationalGroupId(querySpec.sourceId),
                status: querySpec.status === 'active' ? 'ok' : 'warning',
                activationMode: 'automatic',
                adjusted_data_columns: resolvedLineage.columns,
                lineage: {
                    source_keys: [resolvedLineage.sourceKey || querySpec.projectionId].filter(Boolean),
                    gold_fields: resolvedLineage.sourceKey
                        ? [{
                            source_key: resolvedLineage.sourceKey,
                            columns: resolvedLineage.columns
                        }]
                        : []
                },
                query: querySpec.sql,
                sql: querySpec.sql,
                grid_span: querySpec.gridSpan || 'col-span-1',
                color_theme: querySpec.colorTheme || querySpec.color_theme || 'theme-audience',
                footerText: querySpec.executionPolicy?.mode || 'runtime',
                footerBottom: 'Projection query'
            };
        });

        const mlInsights = (projectionPlan?.mlRecommendations || []).map((recommendation: any) => {
            const resolvedLineage = resolveLineage(
                recommendation.sourceId,
                recommendation.projectionId,
                [
                    ...(recommendation.targetColumn ? [recommendation.targetColumn] : []),
                    ...(recommendation.featureColumns || [])
                ]
            );

            return {
                id: recommendation.recommendationId,
                title: recommendation.title,
                type: recommendation.taskType,
                widget_type: 'predictive',
                group_id: getMlGroupId(recommendation.sourceId),
                status: 'warning',
                activationMode: 'manual',
                adjusted_data_columns: resolvedLineage.columns,
                lineage: {
                    source_keys: [resolvedLineage.sourceKey || recommendation.projectionId].filter(Boolean),
                    gold_fields: resolvedLineage.sourceKey
                        ? [{
                            source_key: resolvedLineage.sourceKey,
                            columns: resolvedLineage.columns
                        }]
                        : []
                },
                color_theme: recommendation.colorTheme || recommendation.color_theme || 'theme-productivity',
                footerText: 'Manual approval',
                footerBottom: recommendation.scaffoldId || 'ML scaffold'
            };
        });

        const group = sourceProfiles.flatMap((profile) => {
            const sourceQueries = (projectionPlan?.querySpecs || []).filter((querySpec: any) => querySpec.sourceId === profile.sourceId);
            const sourceRecommendations = (projectionPlan?.mlRecommendations || []).filter((recommendation: any) => recommendation.sourceId === profile.sourceId);
            const sourceGroups: any[] = [];

            if (!projectionPlan || sourceQueries.length > 0) {
                const adjustedIds = sourceQueries.length > 0
                    ? dedupeStrings(sourceQueries.map((querySpec: any) => resolveLineage(
                        querySpec.sourceId,
                        querySpec.projectionId,
                        querySpec.dependencies?.columns || []
                    ).sourceKey))
                    : (profile.goldViews || []).map((view: any) => view.id);

                sourceGroups.push({
                    id: getOperationalGroupId(profile.sourceId),
                    name: `${profile.sourceId}-operational`,
                    title: `${profile.sourceName} Operational`,
                    status: 'ok',
                    color: 'default',
                    activation_mode: 'automatic',
                    adjusted_data_ids: adjustedIds
                });
            }

            if ((!projectionPlan && isMlEligible(profile)) || sourceRecommendations.length > 0) {
                const adjustedIds = sourceRecommendations.length > 0
                    ? dedupeStrings(sourceRecommendations.map((recommendation: any) => resolveLineage(
                        recommendation.sourceId,
                        recommendation.projectionId,
                        [
                            ...(recommendation.targetColumn ? [recommendation.targetColumn] : []),
                            ...(recommendation.featureColumns || [])
                        ]
                    ).sourceKey))
                    : dedupeStrings([getMetricViewId(profile)]);

                sourceGroups.push({
                    id: getMlGroupId(profile.sourceId),
                    name: `${profile.sourceId}-ml-recommended`,
                    title: `${profile.sourceName} ML Recommended`,
                    status: 'warning',
                    color: 'blue',
                    activation_mode: 'manual',
                    adjusted_data_ids: adjustedIds
                });
            }

            if (isReverseEtlEligible(profile)) {
                sourceGroups.push({
                    id: getReverseGroupId(profile.sourceId),
                    name: `${profile.sourceId}-reverse-etl-recommended`,
                    title: `${profile.sourceName} Reverse ETL Recommended`,
                    status: 'warning',
                    color: 'blue',
                    activation_mode: 'manual',
                    adjusted_data_ids: dedupeStrings([
                        resolveBestViewId(
                            profile,
                            (profile.entityKeyCandidates || []).concat(profile.metricCandidates || []).slice(0, 4),
                            getMetricViewId(profile)
                        )
                    ])
                });
            }

            return sourceGroups;
        });

        return {
            connector,
            actionType,
            origin: [],
            adjustedData,
            group,
            insight: [...queryInsights, ...mlInsights]
        };
    }

    public async saveProjectDiscovery(tenantId: string, projectId: string, discovery: any, vitals?: RuntimeVitals) {
        // Force reading from DynamoDB to get the absolute latest state (avoid overwriting concurrent changes)
        const project = await this.projectRepo.findById(tenantId, projectId);
        if (!project) {
            console.error(`[Orchestrator] Cannot save results: Project ${projectId} not found.`);
            return;
        }

        const compactDiscovery = this.buildCompactDiscoverySnapshot(discovery, project.parrotRuntime);
        const compactDiscoverySize = this.estimateJsonSizeBytes(compactDiscovery);
        console.log(
            `[Orchestrator] Compact discovery snapshot size for ${projectId}: ${compactDiscoverySize} bytes`
        );
        if (compactDiscoverySize > 250_000) {
            console.warn(
                `[Orchestrator] Compact discovery snapshot for ${projectId} is approaching DynamoDB limits: ${compactDiscoverySize} bytes`
            );
        }

        // Build queryConfigs from insights discovery
        const insights = compactDiscovery.insight || [];
        project.queryConfigs = insights
            .map((db: any) => ({
                widgetId: db.id,
                sqlString: db.query || db.sql
            }))
            .filter((q: any) => q.widgetId && q.sqlString);

        const preservedOverrides = Array.isArray(project.discoveryMetadata?.decisionOverrides)
            ? project.discoveryMetadata.decisionOverrides
            : [];

        // Update Project Entity with discovery metadata while keeping user-authored overrides.
        project.discoveryMetadata = {
            ...compactDiscovery,
            decisionOverrides: preservedOverrides
        };
        project.status = 'active';

        // Save execution telemetry / vitals if provided
        if (vitals) {
            project.runtimeVitals = project.runtimeVitals || { runsThisMonth: 0, estimatedTokensUsed: 0 };
            project.runtimeVitals.lastRunAt = vitals.completedAt;
            project.runtimeVitals.lastRunDurationMs = vitals.runtimeLatencyMs;
            project.runtimeVitals.lastPathUsed = vitals.pathUsed;
            project.runtimeVitals.cacheHitRate = vitals.cacheHitRate;
            project.runtimeVitals.cacheEligibleQueryRatio = vitals.cacheEligibleQueryRatio;
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

    private applySentinelBusinessRelevanceFilter(projectionPlan: ParrotProjectionPlan): void {
        const signals: ParrotSentinelModelSignal[] = Array.isArray(projectionPlan?.sentinelModelSignals)
            ? projectionPlan.sentinelModelSignals
            : [];
        const filteredQueryIds = new Set(
            signals
                .filter((signal: ParrotSentinelModelSignal) =>
                    signal.modelName === 'BusinessRelevanceModel'
                    && signal.targetType === 'query'
                    && signal.score < 0.35
                )
                .map((signal: ParrotSentinelModelSignal) => signal.targetId)
        );

        if (filteredQueryIds.size === 0) {
            return;
        }

        projectionPlan.querySpecs = (projectionPlan.querySpecs || []).filter((querySpec: ParrotQuerySpec) => !filteredQueryIds.has(querySpec.queryId));

        const details = (projectionPlan.summary?.details || {}) as Record<string, unknown>;
        const existingWarnings = Array.isArray(details.warnings) ? details.warnings.map((warning) => String(warning)) : [];
        if (!existingWarnings.includes(`sentinel_filtered_queries:${filteredQueryIds.size}`)) {
            existingWarnings.push(`sentinel_filtered_queries:${filteredQueryIds.size}`);
        }

        if (projectionPlan.summary) {
            projectionPlan.summary.details = {
                ...details,
                queryCount: projectionPlan.querySpecs.length,
                warnings: existingWarnings,
                sentinelFilteredQueryCount: filteredQueryIds.size,
                sentinelFilteredQueryIds: [...filteredQueryIds]
            };

            projectionPlan.summary.text = [
                projectionPlan.summary.text,
                `Sentinel filtered ${filteredQueryIds.size} low-relevance dashboard query${filteredQueryIds.size === 1 ? '' : 'ies'}.`
            ].join(' ');
        }
    }

    private buildCompactDiscoverySnapshot(discovery: any, runtimeMetadata?: any): any {
        const sourceMetadata = Array.isArray(discovery?.sourceMetadata)
            ? discovery.sourceMetadata.map((profile: any) => ({
                sourceId: profile.sourceId,
                sourceName: profile.sourceName,
                sourceType: profile.sourceType,
                connectorId: profile.connectorId,
                iconPath: profile.iconPath,
                uri: profile.uri,
                metadataUri: profile.metadataUri,
                fingerprint: profile.fingerprint,
                entityKeyCandidates: profile.entityKeyCandidates || [],
                timestampCandidates: profile.timestampCandidates || [],
                metricCandidates: profile.metricCandidates || [],
                transformations: profile.transformations || [],
                goldViews: profile.goldViews || []
            }))
            : [];

        return {
            connector: discovery?.connector || [],
            actionType: discovery?.actionType || [],
            origin: discovery?.origin || [],
            adjustedData: discovery?.adjustedData || [],
            group: discovery?.group || [],
            insight: discovery?.insight || [],
            sourceMetadata,
            projectionSpecs: discovery?.projectionSpecs || discovery?.projectionPlan?.projectionSpecs || [],
            querySpecs: discovery?.querySpecs || discovery?.projectionPlan?.querySpecs || [],
            mlRecommendations: discovery?.mlRecommendations || discovery?.projectionPlan?.mlRecommendations || [],
            invalidationHints: discovery?.invalidationHints || discovery?.projectionPlan?.invalidationHints || [],
            sentinelModelSignals: discovery?.sentinelModelSignals || discovery?.projectionPlan?.sentinelModelSignals || [],
            sentinelPolicyState: discovery?.sentinelPolicyState,
            metadataArtifacts: discovery?.metadataArtifacts || {
                requestId: runtimeMetadata?.lastRequestId,
                mindmapYamlUri: runtimeMetadata?.mindmapYamlUri,
                mindmapManifestUri: runtimeMetadata?.mindmapManifestUri,
                projectionPlanUri: runtimeMetadata?.projectionPlanUri,
                queryRegistryUri: runtimeMetadata?.queryRegistryUri,
                projectionRegistryUri: runtimeMetadata?.projectionRegistryUri
            }
        };
    }

    private estimateJsonSizeBytes(value: unknown): number {
        try {
            return Buffer.byteLength(JSON.stringify(value ?? {}), 'utf8');
        } catch {
            return 0;
        }
    }
}
