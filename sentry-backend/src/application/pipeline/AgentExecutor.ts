import { ISandboxProvider } from '../../infrastructure/providers/ISandboxProvider';
import { R2StorageService } from '../../infrastructure/storage/R2StorageService';
import { AgentTaskParams, AgentTaskResult } from './types';
import { config } from '../../config';

export class AgentExecutor {
    private sandboxProvider: ISandboxProvider;
    private r2StorageService: R2StorageService;

    constructor(sandboxProvider: ISandboxProvider, r2StorageService: R2StorageService) {
        this.sandboxProvider = sandboxProvider;
        this.r2StorageService = r2StorageService;
    }

    /**
     * Executes a single Agent Task in the sandbox.
     * SMART LOGIC: Checks if a verified script exists in R2 to avoid LLM costs.
     */
    public async execute(params: AgentTaskParams): Promise<AgentTaskResult> {
        const { tenantId, projectId, taskName, systemPromptUri, boilerplateUri, additionalEnvVars } = params;
        console.log(`[AgentExecutor] Preparing task: ${taskName} for ${projectId}`);

        const startMs = Date.now();

        // 1. Check for cached script
        let hasCache = await this.r2StorageService.scriptExists(tenantId, projectId, taskName);
        let verifiedScriptUri = hasCache ? this.r2StorageService.getScriptUri(tenantId, projectId, taskName) : undefined;

        // GRANULAR CACHING: Override cache if regeneration is explicitly requested
        if (params.forceRegenerate) {
            console.log(`[AgentExecutor] forceRegenerate is TRUE. Bypassing cache for ${taskName}.`);
            hasCache = false;
            verifiedScriptUri = undefined;
        }

        if (hasCache) {
            console.log(`[AgentExecutor] CACHE HIT for ${taskName}. Skipping LLM generation.`);
        } else {
            console.log(`[AgentExecutor] CACHE MISS (or forced) for ${taskName}. Will trigger LLM Discovery.`);
        }

        const sandboxConfig = {
            template: 'sentry-agent-v1',
            envVars: {
                'INJECTED_SYSTEM_PROMPT': systemPromptUri.startsWith('s3://') ? '' : systemPromptUri,
                'R2_PROMPT_URI': systemPromptUri.startsWith('s3://') ? systemPromptUri : '',
                'R2_BOILERPLATE_URI': boilerplateUri,
                'R2_VERIFIED_SCRIPT_URI': verifiedScriptUri || '', // If present, manager runs this directly

                'R2_REGION': config.r2.region || 'auto',
                'R2_ENDPOINT_CLEAN': (config.r2.endpoint || '').replace(/^https?:\/\//, ''),
                'R2_ENDPOINT_URL': (config.r2.endpoint || '').startsWith('http') ? config.r2.endpoint : `https://${config.r2.endpoint}`,
                'R2_ACCESS_KEY_ID': config.r2.accessKeyId || '',
                'R2_SECRET_ACCESS_KEY': config.r2.secretAccessKey || '',

                ...additionalEnvVars
            }
        };

        const sandboxId = await this.sandboxProvider.startSandbox(sandboxConfig);

        try {
            console.log(`[AgentExecutor] Executing in sandbox ${sandboxId}...`);
            const execution = await this.sandboxProvider.executeTask(sandboxId, "python /root/agent_manager.py");

            const endMs = Date.now();
            const durationMs = endMs - startMs;

            if (!execution.success) {
                throw new Error(`Execution failed: ${execution.error}`);
            }

            // 1. Save FULL Agent Logs (reasoning + execution results) to R2
            await this.r2StorageService.saveLog(tenantId, projectId, taskName, execution.logs);

            // 2. If it was a CACHE MISS (LLM run), save the generated script for next time
            if (!hasCache) {
                const scriptMatch = execution.logs.match(/--- AGENT_FINAL_SCRIPT_START ---\n([\s\S]*?)\n--- AGENT_FINAL_SCRIPT_END ---/);
                if (scriptMatch && scriptMatch[1]) {
                    const generatedScript = scriptMatch[1];
                    console.log(`[AgentExecutor] Saving newly discovered script for ${taskName} to R2 cache.`);
                    await this.r2StorageService.saveScript(tenantId, projectId, taskName, generatedScript);
                }
            }

            // 3. Estimate Tokens Used
            // Using real Gemini usage metadata if agent_manager prints it, otherwise estimating from log size
            let estimatedTokens = 0;
            const tokenMatch = execution.logs.match(/AGENT_TOKENS:(.*?)(?=\n|$)/);
            if (tokenMatch && tokenMatch[1]) {
                 try {
                     const usageData = JSON.parse(tokenMatch[1].trim());
                     // gemini returns total_token_count or similar
                     if (usageData.total_token_count) {
                         estimatedTokens = usageData.total_token_count;
                     }
                 } catch (e) {}
            }
            if (estimatedTokens === 0 && !hasCache) {
                // Fallback estimate (~4 chars per token)
                estimatedTokens = Math.ceil(execution.logs.length / 4);
            }

            // 4. Parse LLM-generated discovery (from agent_manager reasoning)
            const llmMatch = [...execution.logs.matchAll(/--- AGENT_DISCOVERY_METADATA ---\n([\s\S]*?)(\n---|$)/g)];
            let llmDiscovery = {};
            llmMatch.forEach(m => {
                try {
                    Object.assign(llmDiscovery, JSON.parse(m[1].trim()));
                } catch (e) { }
            });

            // Extract only the execution phase stdout to avoid parsing the LLM-generated script containing print() statements
            let stdoutLogs = execution.logs;
            if (stdoutLogs.includes('--- AGENT_EXECUTION_STDOUT ---')) {
                // Take everything after the execution start marker
                stdoutLogs = stdoutLogs.split('--- AGENT_EXECUTION_STDOUT ---').pop() || '';
            }
            if (stdoutLogs.includes('--- STDOUT ---')) {
                // Further narrow down to the actual script output
                stdoutLogs = stdoutLogs.split('--- STDOUT ---')[1];
            }

            // 5. Parse Code-generated discovery (prefixed with AGENT_DISCOVERY:)
            // We split by lines to avoid greedy matching capturing subsequent prints
            const lines = stdoutLogs.split('\n');
            let codeDiscovery = {};
            for (const line of lines) {
                if (line.startsWith('AGENT_DISCOVERY:')) {
                    const jsonStr = line.replace('AGENT_DISCOVERY:', '').trim();
                    try {
                        Object.assign(codeDiscovery, JSON.parse(jsonStr));
                    } catch (e: any) {
                        console.warn(`[AgentExecutor] Failed to parse AGENT_DISCOVERY line: ${e.message}`);
                    }
                }
            }

            // Merge discoveries
            const discoveryMetadata = {
                ...llmDiscovery,
                ...codeDiscovery
            };

            const resultMatch = [...stdoutLogs.matchAll(/AGENT_RESULT:(.*?)(?=\nAGENT_|$)/gs)];
            let agentResult = null;
            if (resultMatch.length > 0) {
                const rawContent = resultMatch[resultMatch.length - 1][1].trim();
                try {
                    agentResult = JSON.parse(rawContent);
                } catch (e: any) {
                    // Fallback: search for first valid JSON object/array if there's trailing noise
                    const jsonCandidate = rawContent.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
                    if (jsonCandidate) {
                        try {
                            agentResult = JSON.parse(jsonCandidate[0]);
                        } catch (e2: any) {
                            console.warn(`[AgentExecutor] Failed to parse AGENT_RESULT for ${taskName}: ${e2.message}`);
                        }
                    }
                }
            }

            const hasAnyDiscovery = Object.keys(discoveryMetadata).length > 0;
            console.log(`[AgentExecutor] Task ${taskName} complete (${durationMs}ms). Cache hit: ${hasCache}. Tokens: ~${estimatedTokens}`);

            return {
                success: true,
                result: agentResult,
                discovery: hasAnyDiscovery ? discoveryMetadata : null,
                logs: execution.logs,
                timing: { startMs, endMs, durationMs },
                estimatedTokens
            };

        } finally {
            await this.sandboxProvider.stopSandbox(sandboxId);
        }
    }
}
