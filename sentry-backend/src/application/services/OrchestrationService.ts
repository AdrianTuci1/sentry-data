import { ISandboxProvider } from '../../infrastructure/providers/ISandboxProvider';
import { ProjectRepository } from '../../infrastructure/repositories/ProjectRepository';
import { R2StorageService } from '../../infrastructure/storage/R2StorageService';
import { SSEManager } from '../../services/sse/SSEManager';
import { config } from '../../config';

/**
 * OrchestrationService manages the Directed Acyclic Graph (DAG) of Multi-Agent execution.
 */
export class OrchestrationService {
    private sandboxProvider: ISandboxProvider;
    private projectRepo: ProjectRepository;
    private r2StorageService: R2StorageService;
    private sseManager: SSEManager;

    constructor(
        sandboxProvider: ISandboxProvider,
        projectRepo: ProjectRepository,
        r2StorageService: R2StorageService,
        sseManager: SSEManager
    ) {
        this.sandboxProvider = sandboxProvider;
        this.projectRepo = projectRepo;
        this.r2StorageService = r2StorageService;
        this.sseManager = sseManager;
    }

    /**
     * Executes a single Agent Step.
     * SMART LOGIC: Checks if a verified script exists in R2 to avoid LLM costs.
     */
    private async executeAgentTask(
        tenantId: string,
        projectId: string,
        taskName: string,
        systemPrompt: string,
        r2BoilerplateUri: string,
        additionalEnvVars: Record<string, string>
    ): Promise<any> {
        console.log(`[Orchestrator] Preparing task: ${taskName} for ${projectId}`);

        // 1. Check for cached script
        const hasCache = await this.r2StorageService.scriptExists(tenantId, projectId, taskName);
        const verifiedScriptUri = hasCache ? this.r2StorageService.getScriptUri(tenantId, projectId, taskName) : undefined;

        if (hasCache) {
            console.log(`[Orchestrator] CACHE HIT for ${taskName}. Skipping LLM generation.`);
        } else {
            console.log(`[Orchestrator] CACHE MISS for ${taskName}. Will trigger LLM Discovery.`);
        }

        const sandboxConfig = {
            template: 'sentry-agent-v1',
            envVars: {
                'INJECTED_SYSTEM_PROMPT': systemPrompt.startsWith('s3://') ? '' : systemPrompt,
                'R2_PROMPT_URI': systemPrompt.startsWith('s3://') ? systemPrompt : '',
                'R2_BOILERPLATE_URI': r2BoilerplateUri,
                'R2_VERIFIED_SCRIPT_URI': verifiedScriptUri || '', // If present, manager runs this directly

                'R2_REGION': config.r2.region || 'auto',
                'R2_ENDPOINT_CLEAN': (config.r2.endpoint || '').replace(/^https?:\/\//, ''),
                'R2_ENDPOINT_URL': (config.r2.endpoint || '').startsWith('http') ? config.r2.endpoint : `https://${config.r2.endpoint}`,
                'R2_ACCESS_KEY_ID': config.r2.accessKeyId || '',
                'R2_SECRET_ACCESS_KEY': config.r2.secretAccessKey || '',
                'OPENAI_API_KEY': process.env.OPENAI_API_KEY || '',
                'AGENT_MODEL': config.llm.agentModel,

                ...additionalEnvVars
            }
        };

        const sandboxId = await this.sandboxProvider.startSandbox(sandboxConfig);

        try {
            console.log(`[Orchestrator] Executing in sandbox ${sandboxId}...`);
            const execution = await this.sandboxProvider.executeTask(sandboxId, "python /root/agent_manager.py");

            if (!execution.success) {
                throw new Error(`Execution failed: ${execution.error}`);
            }

            // 2. If it was a CACHE MISS (LLM run), save the generated script for next time
            if (!hasCache) {
                const scriptMatch = execution.logs.match(/--- AGENT_FINAL_SCRIPT_START ---\n([\s\S]*?)\n--- AGENT_FINAL_SCRIPT_END ---/);
                if (scriptMatch && scriptMatch[1]) {
                    const generatedScript = scriptMatch[1];
                    console.log(`[Orchestrator] Saving newly discovered script for ${taskName} to R2 cache.`);
                    await this.r2StorageService.saveScript(tenantId, projectId, taskName, generatedScript);
                }
            }

            // 1. Parse LLM-generated discovery (from agent_manager reasoning)
            const llmMatch = [...execution.logs.matchAll(/--- AGENT_DISCOVERY_METADATA ---\n([\s\S]*?)(\n---|$)/g)];
            let llmDiscovery = {};
            llmMatch.forEach(m => {
                try {
                    Object.assign(llmDiscovery, JSON.parse(m[1].trim()));
                } catch (e) { }
            });

            // 2. Parse Code-generated discovery (prefixed with AGENT_DISCOVERY:)
            const codeMatch = [...execution.logs.matchAll(/AGENT_DISCOVERY:(\{.*?\})/g)];
            let codeDiscovery = {};
            codeMatch.forEach(m => {
                try {
                    Object.assign(codeDiscovery, JSON.parse(m[1].trim()));
                } catch (e) { }
            });

            // Merge discoveries
            const discoveryMetadata = {
                ...llmDiscovery,
                ...codeDiscovery
            };

            const resultLine = execution.logs.split('\n').find(line => line.startsWith('AGENT_RESULT:'));
            let agentResult = null;
            if (resultLine) {
                try {
                    const jsonString = resultLine.replace('AGENT_RESULT:', '').trim();
                    agentResult = JSON.parse(jsonString);
                } catch (e) {
                    console.warn(`[Orchestrator] Failed to parse AGENT_RESULT for ${taskName}:`, e);
                }
            }

            const hasAnyDiscovery = Object.keys(discoveryMetadata).length > 0;
            console.log(`[Orchestrator] Task ${taskName} complete. Discovery captured: ${hasAnyDiscovery}`);

            return {
                success: true,
                result: agentResult,
                discovery: hasAnyDiscovery ? discoveryMetadata : null,
                logs: execution.logs
            };

        } finally {
            await this.sandboxProvider.stopSandbox(sandboxId);
        }
    }

    /**
     * Initiates the End-to-End full pipeline for a project based on newly connected data sources.
     */
    public async runFullPipeline(tenantId: string, projectId: string, rawSourceUris: string[]): Promise<void> {
        console.log(`[Orchestrator] Starting End-to-End Pipeline for Project ${projectId}`);

        const systemBucket = config.r2.bucketData;
        const dataBucket = config.r2.bucketData;
        const boilerplatePrefix = `s3://${systemBucket}/system/boilerplates/tasks`;
        const promptPrefix = `s3://${systemBucket}/system/boilerplates/prompts`;
        const manifestUri = `s3://${systemBucket}/system/config/frontend-widget-manifest.yml`;

        // --- STEP 1: NORMALIZATION (PARALLEL) ---
        console.log(`[Orchestrator] STEP 1: Normalizing ${rawSourceUris.length} sources...`);
        const normalizationPromises = rawSourceUris.map((uri, index) => {
            const targetUri = this.r2StorageService.getS3Uri(tenantId, projectId, 'silver', `normalized_source_${index}.parquet`);
            const taskName = `Normalization_Source_${index}`;
            return this.executeAgentTask(
                tenantId,
                projectId,
                taskName,
                `${promptPrefix}/data_normalizer.txt`,
                `${boilerplatePrefix}/data_normalizer.py`,
                {
                    'INJECTED_RAW_URI': uri,
                    'INJECTED_NORMALIZED_URI': targetUri
                }
            );
        });

        const normalizationResults = await Promise.all(normalizationPromises);

        // Collect discoveries
        let cumulativeDiscovery: any = {};
        normalizationResults.forEach((res, index) => {
            if (res.discovery) {
                cumulativeDiscovery[`normalization_source_${index}`] = res.discovery;
            }
        });

        // Fallback to dummy URIs if execution failed to return them properly in our mock scenario
        const normalizedUris = normalizationResults.map((res, index) => res.result?.output_uri || this.r2StorageService.getS3Uri(tenantId, projectId, 'silver', `normalized_source_${index}.parquet`)).filter(Boolean);
        console.log(`[Orchestrator] STEP 1 Complete. Normalized URIs:`, normalizedUris);
        this.sseManager.broadcastToTenant(tenantId, 'pipeline_progress', {
            step: 'Normalization',
            progress: 20,
            status: 'completed',
            discovery: cumulativeDiscovery
        });


        // --- STEP 2: FEATURE ENGINEERING (SEQUENTIAL after step 1) ---
        console.log(`[Orchestrator] STEP 2: Feature Engineering (Gold Table Generation)...`);
        const goldTableUri = this.r2StorageService.getS3Uri(tenantId, projectId, 'gold', 'gold_layer.parquet');

        const feResult = await this.executeAgentTask(
            tenantId,
            projectId,
            `Feature_Engineering`,
            `${promptPrefix}/feature_engineer.txt`,
            `${boilerplatePrefix}/feature_engineer.py`,
            {
                'INJECTED_DATA_URIS': JSON.stringify(normalizedUris),
                'TARGET_GOLD_URI': goldTableUri
            }
        );

        if (feResult.discovery) {
            cumulativeDiscovery['feature_engineering'] = feResult.discovery;
        }

        console.log(`[Orchestrator] STEP 2 Complete.`);
        this.sseManager.broadcastToTenant(tenantId, 'pipeline_progress', {
            step: 'Feature Engineering',
            progress: 40,
            status: 'completed',
            discovery: feResult.discovery
        });


        // --- STEP 3 & 4: QUERY GENERATION & ML TRAINING (PARALLEL after step 2) ---
        console.log(`[Orchestrator] STEP 3 & 4: Starting SQL Generator and ML Trainer simultaneously...`);

        const mlModelUri = `s3://${dataBucket}/tenants/${tenantId}/projects/${projectId}/ml/sales_forecast_model.joblib`;

        const queryPromise = this.executeAgentTask(
            tenantId,
            projectId,
            `Query_Generator`,
            `${promptPrefix}/query_generator.txt`,
            `${boilerplatePrefix}/query_generator.py`,
            {
                'INJECTED_GOLD_URI': goldTableUri,
                'INJECTED_MANIFEST_URI': manifestUri
            }
        );

        const trainingPromise = this.executeAgentTask(
            tenantId,
            projectId,
            `ML_Trainer`,
            `${promptPrefix}/ml_trainer.txt`,
            `${boilerplatePrefix}/ml_trainer.py`,
            {
                'INJECTED_GOLD_URI': goldTableUri,
                'INJECTED_MODEL_URI': mlModelUri
            }
        );

        const [queriesResult, trainingResult] = await Promise.all([queryPromise, trainingPromise]);

        if (queriesResult.discovery) cumulativeDiscovery['query_generation'] = queriesResult.discovery;
        if (trainingResult.discovery) cumulativeDiscovery['ml_training'] = trainingResult.discovery;

        console.log(`[Orchestrator] STEP 3 & 4 Complete.`);
        this.sseManager.broadcastToTenant(tenantId, 'pipeline_progress', {
            step: 'Query & Model Generation',
            progress: 80,
            status: 'completed',
            discovery: { queries: queriesResult.discovery, training: trainingResult.discovery }
        });

        // Save queries and metadata to the project record
        const project = await this.projectRepo.findOne(tenantId, projectId);
        if (project) {
            project.queryConfigs = Array.isArray(queriesResult.result) ? queriesResult.result : [];
            project.discoveryMetadata = cumulativeDiscovery;
            project.status = 'active';
            await this.projectRepo.createOrUpdate(project);
        }

        // --- STEP 5: INITIAL INFERENCE (SEQUENTIAL after step 4) ---
        console.log(`[Orchestrator] STEP 5: Running initial ML Inference...`);
        const predictionsUri = this.r2StorageService.getS3Uri(tenantId, projectId, 'gold', 'predictions_initial.parquet');
        const inferenceResult = await this.executeAgentTask(
            tenantId,
            projectId,
            `ML_Inference`,
            `${promptPrefix}/ml_inference.txt`,
            `${boilerplatePrefix}/ml_inference.py`,
            {
                'INJECTED_NEW_DATA_URI': goldTableUri,
                'INJECTED_MODEL_URI': mlModelUri,
                'INJECTED_PREDICTIONS_OUTPUT_URI': predictionsUri,
                // Pass R2 credentials explicitly for boto3 inside the script if needed
                'R2_ACCESS_KEY_ID': config.r2.accessKeyId || '',
                'R2_SECRET_ACCESS_KEY': config.r2.secretAccessKey || '',
                'R2_ENDPOINT_URL': (config.r2.endpoint || '').startsWith('http') ? config.r2.endpoint : `https://${config.r2.endpoint}`
            }
        );

        if (inferenceResult.discovery) {
            cumulativeDiscovery['ml_inference'] = inferenceResult.discovery;
            const updatedProject = await this.projectRepo.findOne(tenantId, projectId);
            if (updatedProject) {
                updatedProject.discoveryMetadata = cumulativeDiscovery;
                await this.projectRepo.createOrUpdate(updatedProject);
            }
        }

        console.log(`[Orchestrator] STEP 5 Complete. Predictions at: ${predictionsUri}`);
        this.sseManager.broadcastToTenant(tenantId, 'pipeline_progress', {
            step: 'ML Inference',
            progress: 100,
            status: 'completed',
            discovery: inferenceResult.discovery
        });
        console.log(`[Orchestrator] Pipeline ${projectId} Fully Operational.`);
    }
}
