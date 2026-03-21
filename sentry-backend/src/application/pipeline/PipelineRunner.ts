import { R2StorageService } from '../../infrastructure/storage/R2StorageService';
import { SSEManager } from '../../services/sse/SSEManager';
import { AgentExecutor } from './AgentExecutor';
import { PipelineContext, PipelineResult } from './types';
import { SchemaFingerprint, SourceSchema } from './SchemaFingerprint';
import { config } from '../../config';
import { ProjectRepository } from '../../infrastructure/repositories/ProjectRepository';
import { WidgetService } from '../services/WidgetService';

/**
 * Unified Pipeline Runner
 * Automatically handles Hot (cached) and Cold (LLM) blocks per source.
 * Parallelizes ETL per source to maximize performance.
 */
export class PipelineRunner {
    private agentExecutor: AgentExecutor;
    private r2StorageService: R2StorageService;
    private sseManager: SSEManager;
    private projectRepo: ProjectRepository;
    private widgetService: WidgetService;

    constructor(agentExecutor: AgentExecutor, r2StorageService: R2StorageService, sseManager: SSEManager, projectRepo: ProjectRepository, widgetService: WidgetService) {
        this.agentExecutor = agentExecutor;
        this.r2StorageService = r2StorageService;
        this.sseManager = sseManager;
        this.projectRepo = projectRepo;
        this.widgetService = widgetService;
    }

    public async execute(ctx: PipelineContext): Promise<PipelineResult> {
        console.log(`[PipelineRunner] Executing Unified Path for Project ${ctx.projectId}`);
        const { tenantId, projectId, rawSourceUris, sourceNames } = ctx;

        const startTime = Date.now();

        // --- STEP 0: CHANGE DETECTION (RESOLUTION) ---
        console.log(`[PipelineRunner] STEP 0: Detecting schema changes...`);
        const effectiveSourceNames = rawSourceUris.map((_, i) => (sourceNames?.[i] || `source_${i}`).replace(/\s+/g, '_'));

        // In a real scenario, we would sample the files for schemas. 
        // For now, we use a placeholder or assume forceRediscover implies change.
        const currentSchemas: SourceSchema[] = [];
        const project = await this.projectRepo.findById(tenantId, projectId);

        const currentFingerprint = SchemaFingerprint.compute(currentSchemas);
        let consolidatedInvalidations: string[] = ctx.invalidatedSources || [];

        if (project?.schemaFingerprint) {
            const invalidatedSources = SchemaFingerprint.getInvalidatedSources(project.schemaFingerprint, currentFingerprint);
            consolidatedInvalidations.push(...invalidatedSources);
        }

        consolidatedInvalidations = [...new Set(consolidatedInvalidations)];

        let cumulativeDiscovery: any = project?.discoveryMetadata || {
            connector: [],
            actionType: [],
            adjustedData: [],
            group: [],
            insight: [],
            tables: [],
            metricGroups: [],
            sourceClassifications: [],
            predictionModels: []
        };

        // Ensure arrays exist if object was partial
        const ensureKeys = ['connector', 'actionType', 'adjustedData', 'group', 'insight', 'tables', 'metricGroups', 'sourceClassifications', 'predictionModels'];
        for (const key of ensureKeys) {
            cumulativeDiscovery[key] = cumulativeDiscovery[key] || [];
        }
        // Migrate legacy keys if present from a previous run
        if (cumulativeDiscovery.dashboardGroups && !cumulativeDiscovery.group?.length) {
            cumulativeDiscovery.group = cumulativeDiscovery.dashboardGroups;
        }
        if (cumulativeDiscovery.dashboards && !cumulativeDiscovery.insight?.length) {
            cumulativeDiscovery.insight = cumulativeDiscovery.dashboards;
        }
        delete cumulativeDiscovery.dashboardGroups;
        delete cumulativeDiscovery.dashboards;
        let estimatedTokensUsed = 0;
        let tasksExecuted: string[] = [];
        let hitCount = 0;

        // --- PHASE 1: PARALLEL ETL BLOCKS (Normalization -> Feature Engineering) ---
        console.log(`[PipelineRunner] STEP 1: Processing ${rawSourceUris.length} ETL blocks in parallel...`);

        // OPTIMIZATION: Fetch existing scripts once to avoid redundant R2 calls
        const existingScripts = await this.r2StorageService.listScripts(tenantId, projectId);
        console.log(`[PipelineRunner] Found ${existingScripts.size} existing scripts in project.`);

        const etlBlockPromises = rawSourceUris.map(async (uri, index) => {
            const sourceName = effectiveSourceNames[index];
            const originalSourceName = sourceNames?.[index] || `source_${index}`;

            const goldGlobUri = this.r2StorageService.getGoldGlobUri(tenantId, projectId, sourceName);

            const normTaskName = `Normalization_${sourceName}`;
            const feTaskName = `Feature_Engineering_${sourceName}`;

            const isSourceInvalidated = consolidatedInvalidations.includes(originalSourceName) || false;
            const forceRegenerate = ctx.forceRediscover || isSourceInvalidated;

            // Extra cache check: if script doesn't exist, we MUST regenerate regardless of fingerprint
            const normExists = existingScripts.has(normTaskName);
            const feExists = existingScripts.has(feTaskName);
            const needsRefresh = forceRegenerate || !normExists || !feExists;

            try {
                // Parse naming components: connector > action type > origin
                // Assuming sourceName (original) is like "Olist Orders" or "Google Analytics"
                // Default action type for parquet/stream is 'batch' or 'stream'
                const connector = originalSourceName.split(' ')[0] || 'Unknown';
                const origin = originalSourceName.split(' ').slice(1).join(' ') || originalSourceName;
                const actionType = uri.includes('stream') ? 'stream' : 'batch';

                // 1.1 Normalization
                console.log(`[PipelineRunner] [${sourceName}] Executing Normalization (force: ${forceRegenerate})...`);
                const normRes = await this.agentExecutor.execute({
                    tenantId, projectId, taskName: normTaskName,
                    existingScripts,
                    forceRegenerate
                });

                // 1.2 Feature Engineering
                console.log(`[PipelineRunner] [${sourceName}] Executing Feature Engineering (force: ${forceRegenerate})...`);
                const feRes = await this.agentExecutor.execute({
                    tenantId, projectId, taskName: feTaskName,
                    existingScripts,
                    forceRegenerate
                });

                // Capture Discovery from both stages
                const mergeDiscovery = (disco: any) => {
                    if (!disco) return;
                    
                    // Additive merging for all graph/lineage components (modern keys only)
                    const keysToAppend = ['connector', 'actionType', 'adjustedData', 'group', 'insight', 'tables', 'metricGroups', 'sourceClassifications'];
                    for (const key of keysToAppend) {
                        // Support legacy key names from agents: dashboardGroups -> group, dashboards -> insight
                        const sourceKey = key === 'group' ? (disco.group ? 'group' : 'dashboardGroups') :
                                          key === 'insight' ? (disco.insight ? 'insight' : 'dashboards') : key;
                        if (disco[sourceKey]) {
                            const items = Array.isArray(disco[sourceKey]) ? disco[sourceKey] : [disco[sourceKey]];
                            if (items.length > 0) {
                                cumulativeDiscovery[key] = cumulativeDiscovery[key] || [];
                                if (key === 'connector') {
                                    items.forEach((newItem: any) => {
                                        const existingIndex = cumulativeDiscovery[key].findIndex((c: any) => c.id === newItem.id);
                                        if (existingIndex >= 0) {
                                            cumulativeDiscovery[key][existingIndex] = { ...cumulativeDiscovery[key][existingIndex], ...newItem };
                                        } else {
                                            cumulativeDiscovery[key].push(newItem);
                                        }
                                    });
                                } else {
                                    cumulativeDiscovery[key].push(...items);
                                }
                            }
                        }
                    }
                };

                mergeDiscovery(normRes.discovery);
                mergeDiscovery(feRes.discovery);

                if (normRes.discovery || feRes.discovery) {
                    this.broadcastDiscovery(tenantId, projectId, cumulativeDiscovery);
                }

                return { success: true, normRes, feRes, sourceName, goldGlobUri, tasks: [normTaskName, feTaskName] };
            } catch (err: any) {
                console.error(`[PipelineRunner] [${sourceName}] ETL block failed: ${err.message}`);
                return { success: false, sourceName, error: err.message };
            }
        });

        const etlResults = await Promise.all(etlBlockPromises);
        const successResults = etlResults.filter(r => r.success);

        if (successResults.length === 0) {
            throw new Error("No data sources were successfully processed.");
        }

        // Aggregate results
        successResults.forEach(r => {
            const res = r as any;
            estimatedTokensUsed += res.normRes.estimatedTokens + res.feRes.estimatedTokens;
            if (res.normRes.estimatedTokens === 0) hitCount++;
            if (res.feRes.estimatedTokens === 0) hitCount++;
            tasksExecuted.push(...(res.tasks || []));

            // Note: cumulativeDiscovery was already partially populated by granular broadcasts above
            // IMPORTANT: We skip normRes.discovery to prevent Normalization (Silver) from appearing in the graph.
        });

        const goldGlobUris = successResults.map(r => (r as any).goldGlobUri);

        this.sseManager.broadcastToTenant(tenantId, 'pipeline_progress', {
            step: 'ETL Phase (Unified)',
            progress: 70,
            status: 'completed'
        });

        // --- STEP 3: QUERY GENERATION (Global) ---
        console.log(`[PipelineRunner] STEP 3: Starting SQL Generator...`);
        const qgTaskName = 'Query_Generator';
        tasksExecuted.push(qgTaskName);

        const queriesResult = await this.agentExecutor.execute({
            tenantId, projectId, taskName: qgTaskName,
            existingScripts,
            // If any source changed, we force re-generate the global query logic
            forceRegenerate: ctx.forceRediscover || consolidatedInvalidations.length > 0
        });

        estimatedTokensUsed += queriesResult.estimatedTokens;
        if (queriesResult.estimatedTokens === 0) hitCount++;

        if (queriesResult.discovery) {
            // Normalize legacy keys from agent output
            const dg = queriesResult.discovery.group || queriesResult.discovery.dashboardGroups;
            const db = queriesResult.discovery.insight || queriesResult.discovery.dashboards;
            
            // Query Generator is AUTHORITATIVE for group/insight (replaces, not appends)
            if (dg && Array.isArray(dg) && dg.length > 0) cumulativeDiscovery.group = dg;
            if (db && Array.isArray(db) && db.length > 0) cumulativeDiscovery.insight = db;

            // Additive merging for everything else (sourceClassifications, tables, etc.)
            const skipKeys = new Set(['dashboardGroups', 'dashboards', 'group', 'insight']);
            Object.keys(queriesResult.discovery).forEach(key => {
                if (skipKeys.has(key)) return;
                
                const val = queriesResult.discovery[key];
                if (Array.isArray(val) && val.length > 0) {
                    cumulativeDiscovery[key] = cumulativeDiscovery[key] || [];
                    cumulativeDiscovery[key].push(...val);
                } else if (val && !Array.isArray(val)) {
                    cumulativeDiscovery[key] = val;
                }
            });

            // GRANULAR BROADCAST: After Query Generation
            this.broadcastDiscovery(tenantId, projectId, cumulativeDiscovery);
        }

        this.sseManager.broadcastToTenant(tenantId, 'pipeline_progress', {
            step: 'Query Generation (Unified)',
            progress: 100,
            status: 'completed'
        });

        const endTime = Date.now();
        return {
            path: 'unified',
            discovery: cumulativeDiscovery,
            vitals: {
                pipelineLatencyMs: endTime - startTime,
                pathUsed: 'unified',
                cacheHitRate: tasksExecuted.length > 0 ? hitCount / tasksExecuted.length : 0,
                estimatedTokensUsed,
                tasksExecuted,
                startedAt: new Date(startTime).toISOString(),
                completedAt: new Date(endTime).toISOString()
            }
        };
    }

    private async broadcastDiscovery(tenantId: string, projectId: string, discovery: any) {
        // 1. PERSISTENCE (R2 & DB) - Must happen BEFORE broadcast
        // Save to R2 so Sovereign Agents can pull it (Zero-Injection Context)
        await this.r2StorageService.saveDiscovery(tenantId, projectId, discovery);

        // Save to DB for backend state
        try {
            const project = await this.projectRepo.findById(tenantId, projectId);
            if (project) {
                project.discoveryMetadata = discovery;
                await this.projectRepo.createOrUpdate(project);
                console.log(`[PipelineRunner] Granular discovery persisted for ${projectId}`);
            }
        } catch (err: any) {
            console.warn(`[PipelineRunner] Failed to persist granular discovery: ${err.message}`);
        }

        // 2. Broadcast via SSE for real-time UI notification
        // We strip discoveryMetadata to force the frontend to fetch from authoritative DynamoDB
        this.sseManager.broadcastToTenant(tenantId, 'discovery_updated', {
            projectId
        });
    }
}
