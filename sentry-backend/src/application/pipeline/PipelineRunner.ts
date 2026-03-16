import { R2StorageService } from '../../infrastructure/storage/R2StorageService';
import { SSEManager } from '../../services/sse/SSEManager';
import { AgentExecutor } from './AgentExecutor';
import { PipelineContext, PipelineResult } from './types';
import { SchemaFingerprint, SourceSchema } from './SchemaFingerprint';
import { config } from '../../config';
import { ProjectRepository } from '../../infrastructure/repositories/ProjectRepository';

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

    constructor(agentExecutor: AgentExecutor, r2StorageService: R2StorageService, sseManager: SSEManager, projectRepo: ProjectRepository) {
        this.agentExecutor = agentExecutor;
        this.r2StorageService = r2StorageService;
        this.sseManager = sseManager;
        this.projectRepo = projectRepo;
    }

    public async execute(ctx: PipelineContext): Promise<PipelineResult> {
        console.log(`[PipelineRunner] Executing Unified Path for Project ${ctx.projectId}`);
        const { tenantId, projectId, rawSourceUris, sourceNames } = ctx;
        
        const systemBucket = config.r2.bucketData;
        const boilerplatePrefix = `s3://${systemBucket}/system/boilerplates/tasks`;
        const promptPrefix = `s3://${systemBucket}/system/boilerplates/prompts`;
        const manifestUri = `s3://${systemBucket}/system/config/frontend-widget-manifest.yml`;
        const strategyUri = `s3://${systemBucket}/system/config/business-metrics-strategy.yml`;
        const mindmapManifestUri = `s3://${systemBucket}/system/config/frontend-mindmap-manifest.yml`;
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

        let cumulativeDiscovery: any = {
            tables: [],
            metricGroups: [],
            dashboardGroups: [],
            dashboards: [],
            sourceClassifications: []
        };
        let estimatedTokensUsed = 0;
        let tasksExecuted: string[] = [];
        let hitCount = 0;

        // --- PHASE 1: PARALLEL ETL BLOCKS (Normalization -> Feature Engineering) ---
        console.log(`[PipelineRunner] STEP 1: Processing ${rawSourceUris.length} ETL blocks in parallel...`);
        
        const etlBlockPromises = rawSourceUris.map(async (uri, index) => {
            const sourceName = effectiveSourceNames[index];
            const originalSourceName = sourceNames?.[index] || `source_${index}`;
            
            const normalizedTargetUri = this.r2StorageService.getSilverUri(tenantId, projectId, sourceName, 'normalized.parquet');
            const normalizedGlobUri = this.r2StorageService.getSilverGlobUri(tenantId, projectId, sourceName);
            const goldTargetUri = this.r2StorageService.getGoldUri(tenantId, projectId, sourceName, 'engineered.parquet');
            const goldGlobUri = this.r2StorageService.getGoldGlobUri(tenantId, projectId, sourceName);
            
            const normTaskName = `Normalization_${sourceName}`;
            const feTaskName = `Feature_Engineering_${sourceName}`;
            
            const isSourceInvalidated = consolidatedInvalidations.includes(originalSourceName) || false;
            const forceRegenerate = ctx.forceRediscover || isSourceInvalidated;
            
            // Extra cache check: if script doesn't exist, we MUST regenerate regardless of fingerprint
            const normExists = await this.r2StorageService.scriptExists(tenantId, projectId, normTaskName);
            const feExists = await this.r2StorageService.scriptExists(tenantId, projectId, feTaskName);
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
                    systemPromptUri: `${promptPrefix}/data_normalizer.txt`,
                    boilerplateUri: `${boilerplatePrefix}/data_normalizer.py`,
                    additionalEnvVars: { 
                        'INJECTED_RAW_URI': uri, 
                        'INJECTED_NORMALIZED_URI': normalizedTargetUri,
                        'INJECTED_CONNECTOR': connector.replace(/'/g, "\\'"),
                        'INJECTED_ACTION_TYPE': actionType,
                        'INJECTED_ORIGIN': origin.replace(/'/g, "\\'"),
                        'INJECTED_SOURCE_ID': sourceName
                    },
                    forceRegenerate
                });
                
                // 1.2 Feature Engineering
                console.log(`[PipelineRunner] [${sourceName}] Executing Feature Engineering (force: ${forceRegenerate})...`);
                const feRes = await this.agentExecutor.execute({
                    tenantId, projectId, taskName: feTaskName,
                    systemPromptUri: `${promptPrefix}/feature_engineer.txt`,
                    boilerplateUri: `${boilerplatePrefix}/feature_engineer.py`,
                    additionalEnvVars: {
                        'INJECTED_NORMALIZED_URIS': JSON.stringify([normalizedGlobUri]),
                        'INJECTED_MINDMAP_MANIFEST_URI': mindmapManifestUri,
                        'INJECTED_GOLD_URIS': JSON.stringify([goldTargetUri]),
                        'INJECTED_CONNECTOR': connector.replace(/'/g, "\\'"),
                        'INJECTED_ACTION_TYPE': actionType,
                        'INJECTED_ORIGIN': origin.replace(/'/g, "\\'"),
                        'INJECTED_SOURCE_ID': sourceName
                    },
                    forceRegenerate
                });

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
            
            // Discovery aggregation
            if (res.feRes.discovery) {
                if (res.feRes.discovery.metricGroups) {
                    cumulativeDiscovery.metricGroups.push(...res.feRes.discovery.metricGroups);
                } else if (res.feRes.discovery.tables) {
                    cumulativeDiscovery.tables.push(...res.feRes.discovery.tables);
                }
            }
            // IMPORTANT: We skip normRes.discovery to prevent Normalization (Silver) from appearing in the graph.
            // Only the Feature Engineering (Gold) layer should represent the data source.
        });

        const goldGlobUris = successResults.map(r => (r as any).goldGlobUri);

        this.sseManager.broadcastToTenant(tenantId, 'pipeline_progress', {
            step: 'ETL Phase (Unified)',
            progress: 50,
            status: 'completed'
        });

        // --- STEP 2: SOURCE CLASSIFIER (Optional Global) ---
        console.log(`[PipelineRunner] STEP 2: Classifying Sources...`);
        const scTaskName = 'Source_Classifier';
        tasksExecuted.push(scTaskName);
        const normalizedSchemas = successResults.map(r => (r as any).normRes.discovery).filter(Boolean);

        const scResult = await this.agentExecutor.execute({
            tenantId, projectId, taskName: scTaskName,
            systemPromptUri: `${promptPrefix}/source_classifier.txt`,
            boilerplateUri: `${boilerplatePrefix}/source_classifier.py`,
            additionalEnvVars: { 'INJECTED_SCHEMA_JSON': JSON.stringify(normalizedSchemas) }
        });
        
        estimatedTokensUsed += scResult.estimatedTokens;
        if (scResult.estimatedTokens === 0) hitCount++;
        if (scResult.discovery?.sourceClassifications) {
            cumulativeDiscovery.sourceClassifications = scResult.discovery.sourceClassifications;
        }

        // --- STEP 3: QUERY GENERATION (Global) ---
        console.log(`[PipelineRunner] STEP 3: Starting SQL Generator...`);
        const qgTaskName = 'Query_Generator';
        tasksExecuted.push(qgTaskName);

        const queriesResult = await this.agentExecutor.execute({
            tenantId, projectId, taskName: qgTaskName,
            systemPromptUri: `${promptPrefix}/query_generator.txt`,
            boilerplateUri: `${boilerplatePrefix}/query_generator.py`,
            additionalEnvVars: {
                'INJECTED_GOLD_URIS': JSON.stringify(goldGlobUris),
                'INJECTED_MANIFEST_URI': manifestUri,
                'INJECTED_STRATEGY_URI': strategyUri,
                'INJECTED_METRICS_DISCOVERY': JSON.stringify(cumulativeDiscovery.metricGroups),
                'INJECTED_SOURCE_CLASSIFICATIONS': JSON.stringify(cumulativeDiscovery.sourceClassifications)
            },
            // If any source changed, we force re-generate the global query logic
            forceRegenerate: ctx.forceRediscover || consolidatedInvalidations.length > 0
        });

        estimatedTokensUsed += queriesResult.estimatedTokens;
        if (queriesResult.estimatedTokens === 0) hitCount++;
        
        if (queriesResult.discovery) {
            if (queriesResult.discovery.dashboardGroups) cumulativeDiscovery.dashboardGroups = queriesResult.discovery.dashboardGroups;
            if (queriesResult.discovery.dashboards) cumulativeDiscovery.dashboards = queriesResult.discovery.dashboards;
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
}
