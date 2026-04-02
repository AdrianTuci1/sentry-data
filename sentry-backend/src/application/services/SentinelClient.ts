import { config } from '../../config';

export interface SentinelGoalResponse {
    status: string;
    confidence_score: number;
    goals: string[];
    should_invalidate: boolean;
    reinforcement_learning?: any;
    details?: any;
}

export interface SentinelAlignmentResponse {
    status: string;
    aligned: boolean;
    shouldReplan: boolean;
    reasons: string[];
    executionScore: any;
    details?: any;
}

export class SentinelClient {
    private baseUrl: string;

    constructor() {
        this.baseUrl = config.parrot.sentinelApiUrl;
    }

    public async evaluateNode(tenantId: string, projectId: string, nodeId: string, dataSample: any[], scope: 'source' | 'global' = 'source'): Promise<SentinelGoalResponse | null> {
        if (!this.baseUrl) {
            return null;
        }

        try {
            console.log(`[SentinelClient] Evaluating node ${nodeId} for project ${projectId} (Scope: ${scope})`);
            const response = await fetch(this.resolveApiUrl('evaluate_node'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Internal-Secret': config.worker.secret
                },
                body: JSON.stringify({
                    tenant_id: tenantId,
                    project_id: projectId,
                    node_id: nodeId,
                    scope,
                    data_sample: dataSample
                })
            });

            if (!response.ok) {
                console.warn(`[SentinelClient] Request failed with status ${response.status}`);
                return null;
            }

            const data = await response.json();
            return data as SentinelGoalResponse;
        } catch (error) {
            console.error(`[SentinelClient] Error calling Sentinel API:`, error);
            // If Sentinel is down, we don't want to crash the main orchestrator, just bypass RL goals
            return null;
        }
    }

    public async alignExecutionScore(tenantId: string, projectId: string, executionScore: any): Promise<SentinelAlignmentResponse> {
        if (!this.baseUrl) {
            return this.buildFallbackAlignment(executionScore, 'sentinel_not_configured');
        }

        try {
            console.log(`[SentinelClient] Aligning execution score for project ${projectId}`);
            const response = await fetch(this.resolveApiUrl('align_execution_score'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Internal-Secret': config.worker.secret
                },
                body: JSON.stringify({
                    tenant_id: tenantId,
                    project_id: projectId,
                    execution_score: executionScore
                })
            });

            if (!response.ok) {
                console.warn(`[SentinelClient] Alignment request failed with status ${response.status}`);
                return this.buildFallbackAlignment(executionScore, `sentinel_http_${response.status}`);
            }

            const data = await response.json();
            return {
                status: data.status || 'aligned',
                aligned: data.aligned !== false,
                shouldReplan: data.should_replan === true,
                reasons: Array.isArray(data.reasons) ? data.reasons : [],
                executionScore: data.execution_score || executionScore,
                details: data.details
            };
        } catch (error) {
            console.error(`[SentinelClient] Error aligning execution score:`, error);
            return this.buildFallbackAlignment(executionScore, 'sentinel_unavailable');
        }
    }

    private buildFallbackAlignment(executionScore: any, reason: string): SentinelAlignmentResponse {
        return {
            status: 'fallback_aligned',
            aligned: true,
            shouldReplan: false,
            reasons: [reason],
            executionScore,
            details: {
                mode: 'local_fallback'
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
}
