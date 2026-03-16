import { R2StorageService } from '../../infrastructure/storage/R2StorageService';
import { SSEManager } from '../../services/sse/SSEManager';
import { AgentExecutor } from './AgentExecutor';
import { PipelineContext, PipelineResult } from './types';
import { config } from '../../config';

export class MLPathRunner {
    private agentExecutor: AgentExecutor;
    private r2StorageService: R2StorageService;
    private sseManager: SSEManager;

    constructor(agentExecutor: AgentExecutor, r2StorageService: R2StorageService, sseManager: SSEManager) {
        this.agentExecutor = agentExecutor;
        this.r2StorageService = r2StorageService;
        this.sseManager = sseManager;
    }

    /**
     * Executes the ML Path (usually weekly/periodic)
     * Performs model training, inference, and predictions query generation
     */
    public async execute(ctx: PipelineContext): Promise<PipelineResult> {
        console.log(`[MLPathRunner] Executing ML Path for Project ${ctx.projectId}`);
        const { tenantId, projectId } = ctx;

        const systemBucket = config.r2.bucketData;
        const boilerplatePrefix = `s3://${systemBucket}/system/boilerplates/tasks`;
        const promptPrefix = `s3://${systemBucket}/system/boilerplates/prompts`;
        const manifestUri = `s3://${systemBucket}/system/config/frontend-widget-manifest.yml`;
        const startTime = Date.now();

        let cumulativeDiscovery: any = {
            sourceClassifications: [
                {
                    id: 'ml_insights_engine',
                    name: 'ML Insights Engine',
                    type: 'ml_agent',
                    description: 'Predictive intelligence agent trained on Gold Layer data.',
                    status: 'active',
                    origins: []
                }
            ],
            predictionModels: [],
            dashboardGroups: [],
            dashboards: []
        };
        let estimatedTokensUsed = 0;
        let tasksExecuted: string[] = [];
        let hitCount = 0;

        const effectiveSourceNames = ctx.rawSourceUris.map((_, i) => (ctx.sourceNames?.[i] || `source_${i}`).replace(/\s+/g, '_'));

        const goldGlobUris = effectiveSourceNames.map(name => 
            this.r2StorageService.getGoldGlobUri(tenantId, projectId, name)
        );
        const mlModelUri = this.r2StorageService.getS3Uri(tenantId, projectId, 'system', 'models/active_model.pkl');

        // --- STEP 1: ML STRATEGY (Architect) ---
        console.log(`[MLPathRunner] STEP 1: Designing ML Strategy (Architect)...`);
        const mlArchitectTaskName = 'ML_Architect';
        tasksExecuted.push(mlArchitectTaskName);

        // Inject discovery schemas to skip discovery phase in Architect
        // OPTIMIZED: only pass name and type to save tokens
        const goldSchemas: Record<string, any> = {};
        if (ctx.discovery?.tables) {
            ctx.discovery.tables.forEach((table: any, i: number) => {
                goldSchemas[`gold_${i}`] = table.columns?.map((col: any) => ({ name: col.name, type: col.type }));
            });
        }

        const architectResult = await this.agentExecutor.execute({
            tenantId,
            projectId,
            taskName: mlArchitectTaskName,
            systemPromptUri: `${promptPrefix}/ml_architect.txt`,
            boilerplateUri: `${boilerplatePrefix}/ml_architect.py`,
            additionalEnvVars: {
                'INJECTED_GOLD_URIS': JSON.stringify(goldGlobUris),
                'INJECTED_SCHEMA_JSON': JSON.stringify(goldSchemas)
            },
            forceRegenerate: ctx.forceRediscover
        });

        estimatedTokensUsed += architectResult.estimatedTokens;
        if (architectResult.estimatedTokens === 0) hitCount++;
        
        let snippetName = 'regression'; // Fallback
        let targetVariable = '';
        let strategicReason = '';
        let modelId = 'ml_generic_insight_engine';

        if (architectResult.success && architectResult.result?.recommended_snippet) {
            snippetName = architectResult.result.recommended_snippet;
            targetVariable = architectResult.result.target_variable || '';
            strategicReason = architectResult.result.strategic_reason || '';
            console.log(`[MLPathRunner] Architect strategically selected snippet: ${snippetName} (Target: ${targetVariable})`);
        } else {
            console.warn(`[MLPathRunner] ML Architect didn't return a clear snippet. Defaulting to: ${snippetName}`);
        }

        this.sseManager.broadcastToTenant(tenantId, 'pipeline_progress', {
            step: `ML Architecture Strategy: Using ${snippetName}`,
            progress: 30,
            status: 'completed'
        });

        // --- STEP 2: ML EVALUATION & TRAINING ---
        console.log(`[MLPathRunner] STEP 2: Evaluating & Training Models utilizing snippet: ${snippetName}...`);
        const mlTrainerTaskName = 'ML_Trainer';
        tasksExecuted.push(mlTrainerTaskName);

        const trainingResult = await this.agentExecutor.execute({
            tenantId,
            projectId,
            taskName: mlTrainerTaskName,
            systemPromptUri: `${promptPrefix}/ml_trainer.txt`,
            boilerplateUri: `s3://${systemBucket}/system/boilerplates/snippets/ml/${snippetName}.py`,
            additionalEnvVars: {
                'INJECTED_GOLD_URIS': JSON.stringify(goldGlobUris),
                'INJECTED_MODEL_OUTPUT_URI': mlModelUri,
                'INJECTED_TARGET_VARIABLE': targetVariable.replace(/'/g, "\\'"),
                'INJECTED_STRATEGIC_REASON': strategicReason.replace(/'/g, "\\'"),
                'INJECTED_SCHEMA_JSON': JSON.stringify(goldSchemas)
            },
            forceRegenerate: ctx.forceRediscover
        });
        
        estimatedTokensUsed += trainingResult.estimatedTokens;
        if (trainingResult.estimatedTokens === 0) hitCount++;
        
        if (trainingResult.discovery) {
            cumulativeDiscovery.predictionModels.push(trainingResult.discovery);
            
            // --- ML ORIGIN REGISTRATION ---
            // We add the specific model target as an "origin" of the single AI engine node
            modelId = `ml_${snippetName}_${targetVariable.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
            if (cumulativeDiscovery.sourceClassifications[0]) {
                cumulativeDiscovery.sourceClassifications[0].origins.push(targetVariable || snippetName);
            }
        }

        this.sseManager.broadcastToTenant(tenantId, 'pipeline_progress', {
            step: 'ML Training (ML Path)',
            progress: 40,
            status: 'completed',
            discovery: trainingResult.discovery
        });

        // --- STEP 2: ML INFERENCE ---
        console.log(`[MLPathRunner] STEP 2: Running ML Inference...`);
        const today = new Date().toISOString().split('T')[0];
        const predictionsUri = this.r2StorageService.getS3Uri(tenantId, projectId, 'gold', `${modelId}/${today}/predictions.parquet`);
        const mlInferenceTaskName = 'ML_Inference';
        tasksExecuted.push(mlInferenceTaskName);

        const inferenceResult = await this.agentExecutor.execute({
            tenantId,
            projectId,
            taskName: mlInferenceTaskName,
            systemPromptUri: `${promptPrefix}/ml_inference.txt`,
            boilerplateUri: `${boilerplatePrefix}/ml_inference.py`,
            additionalEnvVars: {
                'INJECTED_NORMALIZED_URIS': JSON.stringify(effectiveSourceNames.map(name => this.r2StorageService.getSilverGlobUri(tenantId, projectId, name))),
                'INJECTED_MODEL_URI': mlModelUri,
                'INJECTED_PREDICTIONS_OUTPUT_URI': predictionsUri,
                'INJECTED_TARGET_VARIABLE': targetVariable.replace(/'/g, "\\'"),
                'INJECTED_SCHEMA_JSON': JSON.stringify(goldSchemas)
            },
            forceRegenerate: ctx.forceRediscover
        });

        estimatedTokensUsed += inferenceResult.estimatedTokens;
        if (inferenceResult.estimatedTokens === 0) hitCount++;

        this.sseManager.broadcastToTenant(tenantId, 'pipeline_progress', {
            step: 'ML Inference (ML Path)',
            progress: 70,
            status: 'completed'
        });

        // --- STEP 3: QUERY GENERATOR V2 (Enhanced) ---
        console.log(`[MLPathRunner] STEP 3: Query Generation v2 (with ML predictions)...`);
        const qgTaskName = 'Query_Generator_V2';
        tasksExecuted.push(qgTaskName);

        const queriesResult = await this.agentExecutor.execute({
            tenantId,
            projectId,
            taskName: qgTaskName,
            systemPromptUri: `${promptPrefix}/query_generator_v2.txt`,
            boilerplateUri: `${boilerplatePrefix}/query_generator.py`,
            additionalEnvVars: {
                'INJECTED_GOLD_URIS': JSON.stringify(goldGlobUris),
                'INJECTED_PREDICTIONS_URI': predictionsUri,
                'INJECTED_MANIFEST_URI': manifestUri,
                'INJECTED_MODEL_TYPE': snippetName,
                'INJECTED_MODEL_ID': modelId,
                'INJECTED_TARGET_VARIABLE': targetVariable.replace(/'/g, "\\'"),
                'INJECTED_STRATEGIC_REASON': strategicReason.replace(/'/g, "\\'")
            },
            forceRegenerate: ctx.forceRediscover
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
            step: 'Query Generation v2 (ML Path)',
            progress: 100,
            status: 'completed',
            discovery: { queries: queriesResult.discovery }
        });

        const endTime = Date.now();
        console.log(`[MLPathRunner] ML Pipeline ${projectId} Fully Operational. Tokens: ~${estimatedTokensUsed}`);

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
