import { createHash } from 'crypto';
import { config } from '../../config';
import { RuntimeContext } from '../../types/runtime';
import {
    ParrotExecutionPlan,
    ParrotExecutionScore,
    ParrotProjectionPlan,
    ParrotRuntimeState,
    ReverseEtlStreamPlan
} from '../../types/parrot';

export class ParrotNeuralEngineService {
    private readonly translatorVersion = 'pne-remote-v2';
    private readonly baseUrl = config.parrot.pneApiUrl;

    public async buildExecutionScore(ctx: RuntimeContext, requestId: string, reverseEtl: ReverseEtlStreamPlan): Promise<ParrotExecutionScore> {
        if (!this.baseUrl) throw new Error("PNE_API_URL not configured");

        const response = await fetch(this.resolveApiUrl('compile_execution_score'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Secret': config.worker.secret
            },
            body: JSON.stringify({
                requestId,
                context: ctx,
                reverseEtl
            })
        });

        const payload = await response.json();
        if (!response.ok || !payload.execution_score) {
            throw new Error(`Remote PNE Error: ${payload.message || 'Failed to compile execution score'}`);
        }
        return payload.execution_score as ParrotExecutionScore;
    }

    public async compileProjectionPlan(runtimeState: ParrotRuntimeState): Promise<ParrotProjectionPlan> {
        if (!this.baseUrl) throw new Error("PNE_API_URL not configured");

        const response = await fetch(this.resolveApiUrl('compile_projection_plan'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Secret': config.worker.secret
            },
            body: JSON.stringify({
                requestId: runtimeState.requestId,
                tenantId: runtimeState.tenantId,
                projectId: runtimeState.projectId,
                sourceProfiles: runtimeState.sourceProfiles,
                workerUrl: config.worker.url,
                workerSecret: config.worker.secret,
                compiledAt: runtimeState.compiledAt
            })
        });

        const payload = await response.json();
        if (!response.ok || !payload.projection_plan) {
            throw new Error(`Remote PNE Error: ${payload.message || 'Failed to compile projection plan'}`);
        }
        return payload.projection_plan as ParrotProjectionPlan;
    }

    public async alignExecutionScore(tenantId: string, projectId: string, executionScore: any): Promise<any> {
        if (!this.baseUrl) throw new Error("PNE_API_URL not configured");
        const requestId = executionScore?.metadata?.request_id;

        const response = await fetch(this.resolveApiUrl('align_execution_score'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Secret': config.worker.secret
            },
            body: JSON.stringify({
                requestId,
                tenantId,
                projectId,
                executionScore
            })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            return {
                status: 'aligned',
                aligned: true,
                shouldReplan: false,
                reasons: [],
                executionScore
            };
        }
        return payload;
    }

    public applyExecutionPlan(executionScore: ParrotExecutionScore, executionPlan: ParrotExecutionPlan): ParrotExecutionScore {
        return {
            ...executionScore,
            infrastructure: {
                engine: executionPlan.engine,
                worker_type: executionPlan.execution_plane === 'kubernetes_ray' ? 'ray_worker' : 'modal_sandbox',
                min_workers: executionPlan.resources.min_workers,
                max_workers: executionPlan.resources.max_workers,
                auto_scale: executionPlan.scheduler.autoscaling
            }
        };
    }

    private resolveApiUrl(path: string): string {
        const normalized = this.baseUrl.replace(/\/+$/, '');
        if (normalized.endsWith('/api/v1')) {
            return `${normalized}/${path}`;
        }
        return `${normalized}/api/v1/${path}`;
    }

    private computeHash(input: unknown): string {
        const hash = createHash('sha256');
        hash.update(JSON.stringify(input));
        return hash.digest('hex');
    }
}
