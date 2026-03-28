import { BasePipelineStep } from './PipelineStep';
import { PipelineContext, PipelineResult } from '../types';
import { R2StorageService } from '../../../infrastructure/storage/R2StorageService';
import { AgentExecutor } from '../AgentExecutor';
import { SentinelClient } from '../../services/SentinelClient';
import { SSEManager } from '../../../services/sse/SSEManager';
import { PipelineConfig } from '../PipelineConfig';

export class ETLStep extends BasePipelineStep {
    constructor(
        private r2StorageService: R2StorageService,
        private agentExecutor: AgentExecutor,
        private sentinel: SentinelClient,
        private sseManager: SSEManager,
        private mergeDiscovery: (cumulative: any, disco: any) => void,
        private broadcastDiscovery: (tenantId: string, projectId: string, discovery: any) => Promise<void>
    ) {
        super();
    }

    getName(): string {
        return 'ETL';
    }

    async execute(ctx: PipelineContext, result: Partial<PipelineResult>): Promise<void> {
        this.log(`Processing ${ctx.rawSourceUris.length} ETL blocks in parallel...`);
        const { tenantId, projectId, rawSourceUris, sourceNames, discovery } = ctx;

        const effectiveSourceNames = rawSourceUris.map((_, i) => (sourceNames?.[i] || `source_${i}`).replace(/\s+/g, '_'));
        const existingScripts = await this.r2StorageService.listScripts(tenantId, projectId);

        const etlBlockPromises = rawSourceUris.map(async (uri, index) => {
            const sourceName = effectiveSourceNames[index];
            const originalSourceName = sourceNames?.[index] || `source_${index}`;
            const goldGlobUri = this.r2StorageService.getGoldGlobUri(tenantId, projectId, sourceName);

            const normTaskName = `Normalization_${sourceName}`;
            const feTaskName = `Feature_Engineering_${sourceName}`;

            const isSourceInvalidated = ctx.invalidatedSources?.includes(originalSourceName) || false;
            const forceRegenerate = ctx.forceRediscover || isSourceInvalidated;

            const normExists = existingScripts.has(normTaskName);
            const feExists = existingScripts.has(feTaskName);
            const needsRefresh = forceRegenerate || !normExists || !feExists;

            try {
                // Sentinel local evaluation
                const { goals, shouldInvalidate } = await this.evaluateSentinelLocal(ctx, sourceName);
                const finalForceRegenerate = forceRegenerate || shouldInvalidate;

                // 1.1 Normalization
                const normRes = await this.agentExecutor.execute({
                    tenantId, projectId, taskName: normTaskName,
                    existingScripts,
                    forceRegenerate: finalForceRegenerate,
                    sentinelGoals: goals
                });

                // 1.2 Feature Engineering
                const feRes = await this.agentExecutor.execute({
                    tenantId, projectId, taskName: feTaskName,
                    existingScripts,
                    forceRegenerate: finalForceRegenerate,
                    sentinelGoals: goals
                });

                this.mergeDiscovery(discovery, normRes.discovery);
                this.mergeDiscovery(discovery, feRes.discovery);

                if (normRes.discovery || feRes.discovery) {
                    await this.broadcastDiscovery(tenantId, projectId, discovery);
                }

                return { success: true, normRes, feRes, sourceName, goldGlobUri, tasks: [normTaskName, feTaskName] };
            } catch (err: any) {
                this.log(`[${sourceName}] ETL block failed: ${err.message}`);
                return { success: false, sourceName, error: err.message };
            }
        });

        const etlResults = await Promise.all(etlBlockPromises);
        const successResults = etlResults.filter(r => r.success);

        if (successResults.length === 0) {
            throw new Error("No data sources were successfully processed.");
        }

        // Aggregate vitals
        successResults.forEach(r => {
            const res = r as any;
            result.vitals!.estimatedTokensUsed += res.normRes.estimatedTokens + res.feRes.estimatedTokens;
            if (res.normRes.estimatedTokens === 0) result.vitals!.cacheHitRate++;
            if (res.feRes.estimatedTokens === 0) result.vitals!.cacheHitRate++;
            result.vitals!.tasksExecuted.push(...(res.tasks || []));
        });

        this.sseManager.broadcastToTenant(tenantId, 'pipeline_progress', {
            step: 'ETL Phase (Unified)', progress: 70, status: 'completed'
        });
    }

    private async evaluateSentinelLocal(ctx: PipelineContext, sourceName: string): Promise<{ goals: string[], shouldInvalidate: boolean }> {
        if (!PipelineConfig.ENABLE_ML_PATH || !ctx.pipelineConfig?.enableMlLab) return { goals: [], shouldInvalidate: false };

        this.log(`[${sourceName}] Requesting local Sentinel evaluation...`);
        try {
            const localEval = await this.sentinel.evaluateNode(ctx.tenantId, ctx.projectId, sourceName, [], 'source');
            return {
                goals: localEval?.goals || [],
                shouldInvalidate: localEval?.should_invalidate || false
            };
        } catch (e) {
            console.warn(`[ETLStep] Local Sentinel evaluation failed for ${sourceName}:`, e);
            return { goals: [], shouldInvalidate: false };
        }
    }
}
