import { config } from '../../config';
import { ParrotExecutionSubmission } from '../../types/parrot';
import { ExecutionProvider, ExecutionSubmitRequest } from './ExecutionProvider';

export class RayDaftExecutionProvider implements ExecutionProvider {
    public readonly engine = 'ray_daft' as const;

    public async submit(request: ExecutionSubmitRequest): Promise<ParrotExecutionSubmission> {
        const submittedAt = new Date().toISOString();
        const endpoint = this.resolveEndpoint();

        if (!endpoint) {
            return {
                submission_id: `ray-deferred-${Date.now()}`,
                request_id: request.requestId,
                engine: this.engine,
                provider: 'ray_daft',
                status: 'deferred',
                submitted_at: submittedAt,
                message: 'Ray/Daft control URL is not configured. Distributed execution plan was staged but not submitted.'
            };
        }

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Internal-Secret': config.worker.secret
                },
                body: JSON.stringify({
                    tenantId: request.tenantId,
                    projectId: request.projectId,
                    requestId: request.requestId,
                    provider: 'ray_daft',
                    executionPlan: request.executionPlan,
                    executionScoreUri: request.executionScoreUri,
                    namespace: config.execution.k8sNamespace,
                    cluster: config.execution.k8sCluster,
                    queue: config.execution.rayQueue
                })
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                return {
                    submission_id: payload.submission_id || `ray-failed-${Date.now()}`,
                    request_id: request.requestId,
                    engine: this.engine,
                    provider: 'ray_daft',
                    status: 'failed',
                    submitted_at: submittedAt,
                    endpoint,
                    message: payload.message || `Ray/Daft execution submission failed with status ${response.status}`,
                    response: payload
                };
            }

            return {
                submission_id: payload.submission_id || `ray-submission-${Date.now()}`,
                request_id: request.requestId,
                engine: this.engine,
                provider: 'ray_daft',
                status: 'submitted',
                submitted_at: submittedAt,
                endpoint,
                message: payload.message || 'Execution plan submitted to Ray/Daft control plane.',
                response: payload
            };
        } catch (error: any) {
            return {
                submission_id: `ray-error-${Date.now()}`,
                request_id: request.requestId,
                engine: this.engine,
                provider: 'ray_daft',
                status: 'failed',
                submitted_at: submittedAt,
                endpoint,
                message: error.message
            };
        }
    }

    private resolveEndpoint(): string | undefined {
        if (config.execution.rayControlUrl) {
            return config.execution.rayControlUrl;
        }

        return config.worker.url.replace(/\/execute\/?$/, '/execution/submit');
    }
}
