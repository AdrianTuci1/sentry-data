export interface SentinelGoalResponse {
    status: string;
    confidence_score: number;
    goals: string[];
    should_invalidate: boolean;
    reinforcement_learning?: any;
    details?: any;
}

export class SentinelClient {
    private baseUrl: string;

    constructor() {
        this.baseUrl = process.env.SENTINEL_API_URL || 'http://localhost:8000/api/v1';
    }

    public async evaluateNode(tenantId: string, projectId: string, nodeId: string, dataSample: any[], scope: 'source' | 'global' = 'source'): Promise<SentinelGoalResponse | null> {
        try {
            console.log(`[SentinelClient] Evaluating node ${nodeId} for project ${projectId} (Scope: ${scope})`);
            const response = await fetch(`${this.baseUrl}/evaluate_node`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
}
