import { R2StorageService } from '../../infrastructure/storage/R2StorageService';
import { SSEManager } from '../../services/sse/SSEManager';
import { AgentExecutor } from './AgentExecutor';
import { PipelineContext, PipelineResult } from './types';
import { config } from '../../config';

export class ColdPathRunner {
    private agentExecutor: AgentExecutor;
    private r2StorageService: R2StorageService;
    private sseManager: SSEManager;

    constructor(agentExecutor: AgentExecutor, r2StorageService: R2StorageService, sseManager: SSEManager) {
        this.agentExecutor = agentExecutor;
        this.r2StorageService = r2StorageService;
        this.sseManager = sseManager;
    }

    /**
     * Executes the Cold Path (LLM Driven)
     * Used when schema has changed, forced rediscover, or new source added.
     * Includes Source Classifier and Insight Strategy discovery.
     */
    public async execute(ctx: PipelineContext): Promise<PipelineResult> {
        console.log(`[ColdPathRunner] Executing Cold Path for Project ${ctx.projectId}`);
        const { tenantId, projectId, rawSourceUris, sourceNames } = ctx;
        
        const systemBucket = config.r2.bucketData;
        const boilerplatePrefix = `s3://${systemBucket}/system/boilerplates/tasks`;
        const promptPrefix = `s3://${systemBucket}/system/boilerplates/prompts`;
        const manifestUri = `s3://${systemBucket}/system/config/frontend-widget-manifest.yml`;
        const strategyUri = `s3://${systemBucket}/system/config/business-metrics-strategy.yml`;
        const mindmapManifestUri = `s3://${systemBucket}/system/config/frontend-mindmap-manifest.yml`;
        const startTime = Date.now();
        
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
        
        // --- STEP 1: NORMALIZATION (SERIALIZED) ---
        console.log(`[ColdPathRunner] STEP 1: Normalizing ${rawSourceUris.length} sources serially to preserve resources...`);
        const normalizationResults = [];
        
        for (let index = 0; index < rawSourceUris.length; index++) {
            const uri = rawSourceUris[index];
            const sourceName = sourceNames?.[index] || `source_${index}`;
            const targetUri = this.r2StorageService.getSilverUri(tenantId, projectId, sourceName, 'normalized.parquet');
            const taskName = `Normalization_${sourceName}`;
            
            // GRANULAR CACHING: Force generation ONLY if the user manually triggers a full refresh OR 
            // if this specific source was detected as changed in SchemaFingerprint
            const isSourceInvalidated = ctx.invalidatedSources?.includes(sourceName) || false;
            const forceRegenerate = ctx.forceRediscover || isSourceInvalidated;
            
            tasksExecuted.push(taskName);
            
            console.log(`[ColdPathRunner] Triggering ${taskName} (forceRegenerate: ${forceRegenerate})`);
            const res = await this.agentExecutor.execute({
                tenantId,
                projectId,
                taskName,
                systemPromptUri: `${promptPrefix}/data_normalizer.txt`,
                boilerplateUri: `${boilerplatePrefix}/data_normalizer.py`,
                additionalEnvVars: {
                    'INJECTED_RAW_URI': uri,
                    'INJECTED_NORMALIZED_URI': targetUri
                },
                forceRegenerate
            });
            
            normalizationResults.push(res);
        }

        // We pass the GLOB URI to subsequent steps so Feature Engineering sees all historical partitions
        const normalizedUris = normalizationResults.map((res, index) => {
            estimatedTokensUsed += res.estimatedTokens;
            if (res.estimatedTokens === 0) hitCount++;
            
            const sourceName = sourceNames?.[index] || `source_${index}`;
            // res.result.output_uri is the exact partition written to.
            // We substitute it with the glob URI for downstream analysis.
            return this.r2StorageService.getSilverGlobUri(tenantId, projectId, sourceName);
        }).filter(Boolean);

        // Collect normalizer discoveries for the Source Classifier
        const normalizedSchemas = normalizationResults.map(res => res.discovery).filter(Boolean);

        this.sseManager.broadcastToTenant(tenantId, 'pipeline_progress', {
            step: 'Normalization (Cold)',
            progress: 20,
            status: 'completed'
        });

        // --- STEP 1.5: SOURCE CLASSIFIER ---
        console.log(`[ColdPathRunner] STEP 1.5: Classifying Sources...`);
        const scTaskName = 'Source_Classifier';
        tasksExecuted.push(scTaskName);
        
        const scResult = await this.agentExecutor.execute({
            tenantId,
            projectId,
            taskName: scTaskName,
            systemPromptUri: `${promptPrefix}/source_classifier.txt`,
            boilerplateUri: `${boilerplatePrefix}/source_classifier.py`,
            additionalEnvVars: {
                'INJECTED_SCHEMA_JSON': JSON.stringify(normalizedSchemas)
            }
        });
        
        estimatedTokensUsed += scResult.estimatedTokens;
        if (scResult.estimatedTokens === 0) hitCount++;
        
        if (scResult.discovery?.sourceClassifications) {
            cumulativeDiscovery.sourceClassifications = scResult.discovery.sourceClassifications;
        }

        // --- STEP 2: FEATURE ENGINEERING ---
        console.log(`[ColdPathRunner] STEP 2: Feature Engineering (N-to-N Gold Tables)...`);
        
        // Generate an N-to-N list of target Gold URIs (exact partition for writing)
        const goldTargetUris = sourceNames?.map(name => 
            this.r2StorageService.getGoldUri(tenantId, projectId, name.replace(/\s+/g, '_'), 'engineered.parquet')
        ) || [];

        // Generate the glob URIs to pass to Query Generator for reading all history
        const goldGlobUris = sourceNames?.map(name => 
            this.r2StorageService.getGoldGlobUri(tenantId, projectId, name.replace(/\s+/g, '_'))
        ) || [];

        const feTaskName = 'Feature_Engineering';
        tasksExecuted.push(feTaskName);

        const feResult = await this.agentExecutor.execute({
            tenantId,
            projectId,
            taskName: feTaskName,
            systemPromptUri: `${promptPrefix}/feature_engineer.txt`,
            boilerplateUri: `${boilerplatePrefix}/feature_engineer.py`,
            additionalEnvVars: {
                'INJECTED_NORMALIZED_URIS': JSON.stringify(normalizedUris), // These are globs
                'INJECTED_MINDMAP_MANIFEST_URI': mindmapManifestUri,
                'INJECTED_GOLD_URIS': JSON.stringify(goldTargetUris) // Write to exact partition
            },
            // If we are in ColdPath, AT LEAST ONE source changed. 
            // Therefore, Feature Engineering MUST be regenerated.
            forceRegenerate: true
        });


        estimatedTokensUsed += feResult.estimatedTokens;
        if (feResult.estimatedTokens === 0) hitCount++;
        
        if (feResult.discovery) {
            if (feResult.discovery.type === 'metricGroups') {
                cumulativeDiscovery.metricGroups.push(feResult.discovery);
            } else {
                Object.assign(cumulativeDiscovery, feResult.discovery);
            }
        }

        this.sseManager.broadcastToTenant(tenantId, 'pipeline_progress', {
            step: 'Feature Engineering (Cold)',
            progress: 50,
            status: 'completed',
            discovery: feResult.discovery
        });

        // --- STEP 3: QUERY GENERATION ---
        // The LLM query_generator now natively acts as the StrategyMatrix due to upgraded prompts.
        console.log(`[ColdPathRunner] STEP 3: Starting SQL Generator...`);
        const qgTaskName = 'Query_Generator';
        tasksExecuted.push(qgTaskName);

        const queriesResult = await this.agentExecutor.execute({
            tenantId,
            projectId,
            taskName: qgTaskName,
            systemPromptUri: `${promptPrefix}/query_generator.txt`,
            boilerplateUri: `${boilerplatePrefix}/query_generator.py`,
            additionalEnvVars: {
                'INJECTED_GOLD_URIS': JSON.stringify(goldGlobUris), // Updated to use globs for analytics spanning history
                'INJECTED_MANIFEST_URI': manifestUri,
                'INJECTED_STRATEGY_URI': strategyUri,
                'INJECTED_METRICS_DISCOVERY': JSON.stringify(cumulativeDiscovery.metricGroups),
                'INJECTED_SOURCE_CLASSIFICATIONS': JSON.stringify(cumulativeDiscovery.sourceClassifications)
            },
            // Same reason as above: if Gold Layer changed, Dashboards must be recreated.
            forceRegenerate: true
        });

        estimatedTokensUsed += queriesResult.estimatedTokens;
        if (queriesResult.estimatedTokens === 0) hitCount++;
        
        if (queriesResult.discovery) {
            if (queriesResult.discovery.dashboardGroups) {
                cumulativeDiscovery.dashboardGroups = queriesResult.discovery.dashboardGroups;
            }
            if (queriesResult.discovery.dashboards) {
                cumulativeDiscovery.dashboards = queriesResult.discovery.dashboards;
            }
        }

        this.sseManager.broadcastToTenant(tenantId, 'pipeline_progress', {
            step: 'Query Generation (Cold)',
            progress: 100,
            status: 'completed',
            discovery: { queries: queriesResult.discovery }
        });

        const endTime = Date.now();
        console.log(`[ColdPathRunner] Pipeline ${projectId} Fully Operational. Tokens: ~${estimatedTokensUsed}`);

        return {
            path: 'cold',
            discovery: cumulativeDiscovery,
            vitals: {
                pipelineLatencyMs: endTime - startTime,
                pathUsed: 'cold',
                cacheHitRate: tasksExecuted.length > 0 ? hitCount / tasksExecuted.length : 0, 
                estimatedTokensUsed,
                tasksExecuted,
                startedAt: new Date(startTime).toISOString(),
                completedAt: new Date(endTime).toISOString()
            }
        };
    }
}
