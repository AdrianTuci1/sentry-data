import { config } from '../../config';
import { ParrotExecutionSubmission } from '../../types/parrot';
import { ExecutionProvider, ExecutionSubmitRequest } from './ExecutionProvider';

export class ModalExecutionProvider implements ExecutionProvider {
    public readonly engine = 'modal' as const;

    public async submit(request: ExecutionSubmitRequest): Promise<ParrotExecutionSubmission> {
        const submittedAt = new Date().toISOString();
        const endpoint = this.resolveEndpoint();

        if (!endpoint) {
            return {
                submission_id: `modal-deferred-${Date.now()}`,
                request_id: request.requestId,
                engine: this.engine,
                provider: 'modal',
                status: 'deferred',
                submitted_at: submittedAt,
                message: 'Modal execution control URL is not configured. Execution plan was staged but not submitted.'
            };
        }

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Internal-Secret': config.worker.secret,
                    'Authorization': `Bearer ${config.modal.modalTokenId}:${config.modal.modalTokenSecret}`
                },
                body: JSON.stringify({
                    tenantId: request.tenantId,
                    projectId: request.projectId,
                    requestId: request.requestId,
                    provider: 'modal',
                    executionPlan: request.executionPlan,
                    executionScoreUri: request.executionScoreUri
                })
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                return {
                    submission_id: payload.submission_id || `modal-failed-${Date.now()}`,
                    request_id: request.requestId,
                    engine: this.engine,
                    provider: 'modal',
                    status: 'failed',
                    submitted_at: submittedAt,
                    endpoint,
                    message: payload.message || `Modal execution submission failed with status ${response.status}`,
                    response: payload
                };
            }

            return {
                submission_id: payload.submission_id || `modal-submission-${Date.now()}`,
                request_id: request.requestId,
                engine: this.engine,
                provider: 'modal',
                status: 'submitted',
                submitted_at: submittedAt,
                endpoint,
                message: payload.message || 'Execution plan submitted to Modal.',
                response: payload
            };
        } catch (error: any) {
            return {
                submission_id: `modal-error-${Date.now()}`,
                request_id: request.requestId,
                engine: this.engine,
                provider: 'modal',
                status: 'failed',
                submitted_at: submittedAt,
                endpoint,
                message: error.message
            };
        }
    }

    private resolveEndpoint(): string | undefined {
        if (config.execution.modalControlUrl) {
            return config.execution.modalControlUrl;
        }

        return config.worker.url.replace(/\/execute\/?$/, '/execution/submit');
    }
}
