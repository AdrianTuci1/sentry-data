import { ISandboxProvider } from '../../infrastructure/providers/ISandboxProvider';
import { R2StorageService } from '../../infrastructure/storage/R2StorageService';
import { AgentTaskParams, AgentTaskResult } from './types';
import { AgentParser } from './engine/AgentParser';
import { AgentDiscoveryExtractor } from './engine/AgentDiscoveryExtractor';
import { AgentTaskStrategy, DefaultAgentTaskStrategy } from './engine/AgentTaskStrategy';

export class AgentExecutor {
    private sandboxProvider: ISandboxProvider;
    private r2StorageService: R2StorageService;
    private strategy: AgentTaskStrategy;

    constructor(
        sandboxProvider: ISandboxProvider,
        r2StorageService: R2StorageService,
        strategy: AgentTaskStrategy = new DefaultAgentTaskStrategy()
    ) {
        this.sandboxProvider = sandboxProvider;
        this.r2StorageService = r2StorageService;
        this.strategy = strategy;
    }

    /**
     * Executes a single Agent Task in the sandbox.
     * SMART LOGIC: Checks if a verified script exists in R2 to avoid LLM costs.
     */
    public async execute(params: AgentTaskParams): Promise<AgentTaskResult> {
        const { tenantId, projectId, taskName } = params;
        console.log(`[AgentExecutor] Preparing task: ${taskName} for ${projectId}`);

        const startMs = Date.now();

        // 1. Check for cached script
        let hasCache = await this.checkCache(params);

        const sandboxConfig = {
            template: this.strategy.getTemplateName(),
            envVars: {
                ...this.strategy.getEnvVars(params),
            }
        };

        const sandboxId = await this.sandboxProvider.startSandbox(sandboxConfig);

        try {
            console.log(`[AgentExecutor] Executing in sandbox ${sandboxId}...`);
            const execution = await this.sandboxProvider.executeTask(sandboxId, this.strategy.getCommand());

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
            const estimatedTokens = AgentParser.estimateTokens(execution.logs, hasCache);

            // 4. Extract standard output for parsing
            const stdoutLogs = AgentParser.extractStdout(execution.logs);

            // 5. Parse Discovery (LLM + Code generated)
            const discoveryMetadata = AgentDiscoveryExtractor.extract(execution.logs, stdoutLogs);

            // 6. Parse Agent Result
            const agentResult = AgentParser.parseResult(stdoutLogs, taskName);

            console.log(`[AgentExecutor] Task ${taskName} complete (${durationMs}ms). Cache hit: ${hasCache}. Tokens: ~${estimatedTokens}`);

            return {
                success: true,
                result: agentResult,
                discovery: Object.keys(discoveryMetadata).length > 0 ? discoveryMetadata : null,
                logs: execution.logs,
                timing: { startMs, endMs, durationMs },
                estimatedTokens
            };

        } finally {
            await this.sandboxProvider.stopSandbox(sandboxId);
        }
    }

    private async checkCache(params: AgentTaskParams): Promise<boolean> {
        const { tenantId, projectId, taskName, existingScripts, forceRegenerate } = params;
        let hasCache = false;

        if (existingScripts) {
            hasCache = existingScripts.has(taskName);
        } else {
            hasCache = await this.r2StorageService.scriptExists(tenantId, projectId, taskName);
        }

        if (forceRegenerate) {
            console.log(`[AgentExecutor] forceRegenerate is TRUE. Bypassing cache for ${taskName}.`);
            return false;
        }

        console.log(`[AgentExecutor] ${hasCache ? 'CACHE HIT' : 'CACHE MISS'} for ${taskName}.`);
        return hasCache;
    }
}
