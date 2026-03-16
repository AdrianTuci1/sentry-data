import { R2StorageService } from '../../infrastructure/storage/R2StorageService';
import { SSEManager } from '../../services/sse/SSEManager';
import { AgentExecutor } from './AgentExecutor';
import { AgentTaskResult, PipelineContext, PipelineResult } from './types';
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
        
        const effectiveSourceNames = rawSourceUris.map((_, i) => (sourceNames?.[i] || `source_${i}`).replace(/\s+/g, '_'));

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
            const sourceName = effectiveSourceNames[index];
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

        const normalizationResults = await Promise.all(normalizationPromises.map(p => p.catch(err => ({ success: false, error: err.message }))));

        const successfulNormalizationResults = normalizationResults.filter(res => !('success' in res && res.success === false)) as AgentTaskResult[];

        if (successfulNormalizationResults.length === 0) {
            throw new Error("No sources were successfully normalized.");
        }

        const normalizedUris = successfulNormalizationResults.map((res, index) => {
            estimatedTokensUsed += res.estimatedTokens;
            const sourceName = effectiveSourceNames[index];
            // Always return the glob URI for downstream steps, regardless of whether it was a cache hit or not
            return this.r2StorageService.getSilverGlobUri(tenantId, projectId, sourceName);
        }).filter(Boolean);

        this.sseManager.broadcastToTenant(tenantId, 'pipeline_progress', {
            step: 'Normalization (Hot)',
            progress: 30,
            status: 'completed'
        });

        // --- STEP 2: FEATURE ENGINEERING ---
        console.log(`[HotPathRunner] STEP 2: Feature Engineering (N-to-N Gold Tables)...`);
        
        // Generate an N-to-N list of target Gold URIs (exact partition for writing)
        const goldTargetUris = effectiveSourceNames.map(name => 
            this.r2StorageService.getGoldUri(tenantId, projectId, name.replace(/\s+/g, '_'), 'engineered.parquet')
        );

        const feTaskName = 'Feature_Engineering';
        tasksExecuted.push(feTaskName);

        const feResult = await this.agentExecutor.execute({
            tenantId,
            projectId,
            taskName: feTaskName,
            systemPromptUri: `${promptPrefix}/feature_engineer.txt`,
            boilerplateUri: `${boilerplatePrefix}/feature_engineer.py`,
            additionalEnvVars: {
                'INJECTED_NORMALIZED_URIS': JSON.stringify(normalizedUris),
                'INJECTED_MINDMAP_MANIFEST_URI': mindmapManifestUri,
                'INJECTED_GOLD_URIS': JSON.stringify(goldTargetUris)
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

        const strategyUri = `s3://${systemBucket}/system/config/business-metrics-strategy.yml`;

        // Generate the glob URIs to pass to Query Generator for reading all history
        const goldGlobUris = effectiveSourceNames.map(name => 
            this.r2StorageService.getGoldGlobUri(tenantId, projectId, name.replace(/\s+/g, '_'))
        );

        const queriesResult = await this.agentExecutor.execute({
            tenantId,
            projectId,
            taskName: qgTaskName,
            systemPromptUri: `${promptPrefix}/query_generator.txt`,
            boilerplateUri: `${boilerplatePrefix}/query_generator.py`,
            additionalEnvVars: {
                'INJECTED_GOLD_URIS': JSON.stringify(goldGlobUris),
                'INJECTED_MANIFEST_URI': manifestUri,
                'INJECTED_STRATEGY_URI': strategyUri,
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
