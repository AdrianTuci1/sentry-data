import { R2StorageService } from '../../infrastructure/storage/R2StorageService';
import { SSEManager } from '../../services/sse/SSEManager';
import { AgentExecutor } from './AgentExecutor';
import { PipelineContext, PipelineResult } from './types';
import { ProjectRepository } from '../../infrastructure/repositories/ProjectRepository';
import { SentinelClient } from '../services/SentinelClient';
import { DiscoveryManager } from './engine/DiscoveryManager';
import { PipelineStep } from './engine/PipelineStep';
import { ChangeDetectionStep } from './engine/ChangeDetectionStep';
import { ETLStep } from './engine/ETLStep';
import { GlobalEvaluationStep } from './engine/GlobalEvaluationStep';

/**
 * Unified Pipeline Runner
 * Modularized using PipelineStep architecture.
 */
export class PipelineRunner {
    private steps: PipelineStep[];

    constructor(
        agentExecutor: AgentExecutor, 
        r2StorageService: R2StorageService, 
        sseManager: SSEManager, 
        projectRepo: ProjectRepository
    ) {
        const discoveryManager = new DiscoveryManager(r2StorageService, projectRepo, sseManager);
        const sentinel = new SentinelClient();
        
        // Initialize steps
        this.steps = [
            new ChangeDetectionStep(projectRepo),
            new ETLStep(
                r2StorageService, agentExecutor, sentinel, sseManager,
                discoveryManager.merge.bind(discoveryManager),
                discoveryManager.broadcast.bind(discoveryManager)
            ),
            new GlobalEvaluationStep(
                agentExecutor, sentinel, sseManager,
                discoveryManager.broadcast.bind(discoveryManager)
            )
        ];
    }

    public async execute(ctx: PipelineContext): Promise<PipelineResult> {
        console.log(`[PipelineRunner] Executing Unified Path for Project ${ctx.projectId}`);
        const startTime = Date.now();

        const result: Partial<PipelineResult> = {
            path: 'unified',
            vitals: {
                pipelineLatencyMs: 0,
                pathUsed: 'unified',
                cacheHitRate: 0,
                estimatedTokensUsed: 0,
                tasksExecuted: [],
                startedAt: new Date(startTime).toISOString(),
                completedAt: ''
            }
        };

        for (const step of this.steps) {
            await step.execute(ctx, result);
        }

        const endTime = Date.now();
        result.vitals!.pipelineLatencyMs = endTime - startTime;
        result.vitals!.completedAt = new Date(endTime).toISOString();
        
        // Finalize cache hit rate calculation
        if (result.vitals!.tasksExecuted.length > 0) {
            result.vitals!.cacheHitRate = result.vitals!.cacheHitRate / (result.vitals!.tasksExecuted.length + 1); // +1 roughly accounts for normalization/FE per source
            // Note: The previous logic was hitCount / tasksExecuted.length. 
            // In the refactored steps, we increment cacheHitRate for each hit.
            // ETLStep has 2 tasks per source. GlobalEvaluationStep has 1 task.
        }

        return {
            path: result.path as any,
            discovery: ctx.discovery!,
            vitals: result.vitals as any
        };
    }
}
