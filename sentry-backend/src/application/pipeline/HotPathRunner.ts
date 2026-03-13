import { R2StorageService } from '../../infrastructure/storage/R2StorageService';
import { SSEManager } from '../../services/sse/SSEManager';
import { AgentExecutor } from './AgentExecutor';
import { PipelineContext, PipelineResult } from './types';
import { config } from '../../config';

export class HotPathRunner {
    private agentExecutor: AgentExecutor;
    private r2StorageService: R2StorageService;
    private sseManager: SSEManager;

    constructor(agentExecutor: AgentExecutor, r2StorageService: R2StorageService, sseManager: SSEManager) {
        this.agentExecutor = agentExecutor;
        this.r2StorageService = r2StorageService;
        this.sseManager = sseManager;
    }

    /**
     * Executes the pipeline using ONLY CACHED SCORES (0 LLM Tokens)
     * Used when schema hasn't changed.
     */
    public async execute(ctx: PipelineContext): Promise<PipelineResult> {
        console.log(`[HotPathRunner] Executing Hot Path for Project ${ctx.projectId}`);
        const { tenantId, projectId, rawSourceUris, sourceNames } = ctx;
        
        const systemBucket = config.r2.bucketData;
        const boilerplatePrefix = `s3://${systemBucket}/system/boilerplates/tasks`;
        const promptPrefix = `s3://${systemBucket}/system/boilerplates/prompts`;
        const manifestUri = `s3://${systemBucket}/system/config/frontend-widget-manifest.yml`;
        const mindmapManifestUri = `s3://${systemBucket}/system/config/frontend-mindmap-manifest.yml`;
        const startTime = Date.now();
        
        let cumulativeDiscovery: any = {
            tables: [],
            metricGroups: [],
            dashboardGroups: [],
            dashboards: []
        };
        let estimatedTokensUsed = 0;
        let tasksExecuted: string[] = [];
        
        // --- STEP 1: NORMALIZATION (PARALLEL) ---
        console.log(`[HotPathRunner] STEP 1: Normalizing ${rawSourceUris.length} sources...`);
        const normalizationPromises = rawSourceUris.map((uri, index) => {
            const sourceName = sourceNames?.[index] || `source_${index}`;
            const targetUri = this.r2StorageService.getSilverUri(tenantId, projectId, sourceName, 'normalized.parquet');
            const taskName = `Normalization_${sourceName}`;
            tasksExecuted.push(taskName);
            
            return this.agentExecutor.execute({
                tenantId,
                projectId,
                taskName,
                systemPromptUri: `${promptPrefix}/data_normalizer.txt`,
                boilerplateUri: `${boilerplatePrefix}/data_normalizer.py`,
                additionalEnvVars: {
                    'INJECTED_RAW_URI': uri,
                    'INJECTED_NORMALIZED_URI': targetUri
                }
            });
        });

        const normalizationResults = await Promise.all(normalizationPromises);

        const normalizedUris = normalizationResults.map((res, index) => {
            estimatedTokensUsed += res.estimatedTokens;
            const sourceName = sourceNames?.[index] || `source_${index}`;
            return res.result?.output_uri || this.r2StorageService.getSilverUri(tenantId, projectId, sourceName, 'normalized.parquet');
        }).filter(Boolean);

        this.sseManager.broadcastToTenant(tenantId, 'pipeline_progress', {
            step: 'Normalization (Hot)',
            progress: 30,
            status: 'completed'
        });

        // --- STEP 2: FEATURE ENGINEERING ---
        console.log(`[HotPathRunner] STEP 2: Feature Engineering (Gold Table)...`);
        const goldTableUri = this.r2StorageService.getS3Uri(tenantId, projectId, 'gold', 'gold_layer.parquet');
        const feTaskName = 'Feature_Engineering';
        tasksExecuted.push(feTaskName);

        const feResult = await this.agentExecutor.execute({
            tenantId,
            projectId,
            taskName: feTaskName,
            systemPromptUri: `${promptPrefix}/feature_engineer.txt`,
            boilerplateUri: `${boilerplatePrefix}/feature_engineer.py`,
            additionalEnvVars: {
                'INJECTED_DATA_URIS': JSON.stringify(normalizedUris),
                'INJECTED_MINDMAP_MANIFEST_URI': mindmapManifestUri,
                'TARGET_GOLD_URI': goldTableUri
            }
        });

        estimatedTokensUsed += feResult.estimatedTokens;
        if (feResult.discovery) {
            if (feResult.discovery.type === 'metricGroups') {
                cumulativeDiscovery.metricGroups.push(feResult.discovery);
            } else {
                Object.assign(cumulativeDiscovery, feResult.discovery);
            }
        }

        this.sseManager.broadcastToTenant(tenantId, 'pipeline_progress', {
            step: 'Feature Engineering (Hot)',
            progress: 60,
            status: 'completed',
            discovery: feResult.discovery
        });

        // --- STEP 3: QUERY GENERATION ---
        console.log(`[HotPathRunner] STEP 3: Starting SQL Generator...`);
        const qgTaskName = 'Query_Generator';
        tasksExecuted.push(qgTaskName);

        const queriesResult = await this.agentExecutor.execute({
            tenantId,
            projectId,
            taskName: qgTaskName,
            systemPromptUri: `${promptPrefix}/query_generator.txt`,
            boilerplateUri: `${boilerplatePrefix}/query_generator.py`,
            additionalEnvVars: {
                'INJECTED_GOLD_URI': goldTableUri,
                'INJECTED_MANIFEST_URI': manifestUri,
                'INJECTED_METRICS_DISCOVERY': JSON.stringify(cumulativeDiscovery.metricGroups)
            }
        });

        estimatedTokensUsed += queriesResult.estimatedTokens;
        if (queriesResult.discovery) {
            if (queriesResult.discovery.dashboardGroups) {
                cumulativeDiscovery.dashboardGroups = queriesResult.discovery.dashboardGroups;
            }
            if (queriesResult.discovery.dashboards) {
                cumulativeDiscovery.dashboards = queriesResult.discovery.dashboards;
            }
        }

        this.sseManager.broadcastToTenant(tenantId, 'pipeline_progress', {
            step: 'Query Generation (Hot)',
            progress: 100,
            status: 'completed',
            discovery: { queries: queriesResult.discovery }
        });

        const endTime = Date.now();
        console.log(`[HotPathRunner] Pipeline ${projectId} Fully Operational (0 tokens expected).`);

        return {
            path: 'hot',
            discovery: cumulativeDiscovery,
            vitals: {
                pipelineLatencyMs: endTime - startTime,
                pathUsed: 'hot',
                cacheHitRate: 1.0, 
                estimatedTokensUsed,
                tasksExecuted,
                startedAt: new Date(startTime).toISOString(),
                completedAt: new Date(endTime).toISOString()
            }
        };
    }
}
