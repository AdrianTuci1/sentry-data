import { BasePipelineStep } from './PipelineStep';
import { PipelineContext, PipelineResult } from '../types';
import { AgentExecutor } from '../AgentExecutor';
import { SentinelClient } from '../../services/SentinelClient';
import { SSEManager } from '../../../services/sse/SSEManager';
import { PipelineConfig } from '../PipelineConfig';

export class GlobalEvaluationStep extends BasePipelineStep {
    constructor(
        private agentExecutor: AgentExecutor,
        private sentinel: SentinelClient,
        private sseManager: SSEManager,
        private broadcastDiscovery: (tenantId: string, projectId: string, discovery: any) => Promise<void>
    ) {
        super();
    }

    getName(): string {
        return 'GlobalEvaluation';
    }

    async execute(ctx: PipelineContext, result: Partial<PipelineResult>): Promise<void> {
        this.log('Starting Global Evaluation and Query Generation...');
        const { tenantId, projectId, discovery } = ctx;

        const { goals: globalGoals, shouldInvalidate: globalShouldInvalidate } = await this.evaluateSentinelGlobal(ctx);
        const globalForceRegen = ctx.forceRediscover || (ctx.invalidatedSources && ctx.invalidatedSources.length > 0) || globalShouldInvalidate;

        const qgTaskName = 'Query_Generator';
        result.vitals!.tasksExecuted.push(qgTaskName);

        const queriesResult = await this.agentExecutor.execute({
            tenantId, projectId, taskName: qgTaskName,
            forceRegenerate: globalForceRegen,
            sentinelGoals: globalGoals
        });

        result.vitals!.estimatedTokensUsed += queriesResult.estimatedTokens;
        if (queriesResult.estimatedTokens === 0) result.vitals!.cacheHitRate++;

        if (queriesResult.discovery) {
            this.updateDiscoveryAuthoritative(discovery, queriesResult.discovery);
            await this.broadcastDiscovery(tenantId, projectId, discovery);
        }

        this.sseManager.broadcastToTenant(tenantId, 'pipeline_progress', {
            step: 'Query Generation (Unified)', progress: 100, status: 'completed'
        });
    }

    private async evaluateSentinelGlobal(ctx: PipelineContext): Promise<{ goals: string[], shouldInvalidate: boolean }> {
        if (!PipelineConfig.ENABLE_ML_PATH || !ctx.pipelineConfig?.enableMlLab) return { goals: [], shouldInvalidate: false };

        this.log('Requesting global Sentinel evaluation...');
        try {
            const globalEval = await this.sentinel.evaluateNode(ctx.tenantId, ctx.projectId, 'global_query_generator', [], 'global');
            return {
                goals: globalEval?.goals || [],
                shouldInvalidate: globalEval?.should_invalidate || false
            };
        } catch (e) {
            console.warn(`[GlobalEvaluationStep] Global Sentinel evaluation failed:`, e);
            return { goals: [], shouldInvalidate: false };
        }
    }

    private updateDiscoveryAuthoritative(cumulative: any, disco: any) {
        const dg = disco.group || disco.dashboardGroups;
        const db = disco.insight || disco.dashboards;

        if (dg && Array.isArray(dg) && dg.length > 0) cumulative.group = dg;
        if (db && Array.isArray(db) && db.length > 0) cumulative.insight = db;

        const skipKeys = new Set(['dashboardGroups', 'dashboards', 'group', 'insight']);
        Object.keys(disco).forEach(key => {
            if (skipKeys.has(key)) return;
            const val = disco[key];
            if (Array.isArray(val) && val.length > 0) {
                cumulative[key] = cumulative[key] || [];
                cumulative[key].push(...val);
            } else if (val && !Array.isArray(val)) {
                cumulative[key] = val;
            }
        });
    }
}
