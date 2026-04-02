import { ExecutionProvider } from '../execution/ExecutionProvider';
import { ParrotExecutionPlan, ParrotExecutionSubmission } from '../../types/parrot';

export class ExecutionPlaneService {
    private readonly providers: Map<ParrotExecutionPlan['engine'], ExecutionProvider>;

    constructor(providers: ExecutionProvider[]) {
        this.providers = new Map(providers.map((provider) => [provider.engine, provider]));
    }

    public async submitPlan(
        tenantId: string,
        projectId: string,
        requestId: string,
        executionPlan: ParrotExecutionPlan,
        executionScoreUri: string
    ): Promise<ParrotExecutionSubmission> {
        const provider = this.providers.get(executionPlan.engine);
        if (!provider) {
            return {
                submission_id: `missing-provider-${Date.now()}`,
                request_id: requestId,
                engine: executionPlan.engine,
                provider: executionPlan.engine,
                status: 'unavailable',
                submitted_at: new Date().toISOString(),
                message: `No execution provider is registered for engine ${executionPlan.engine}.`
            };
        }

        return provider.submit({
            tenantId,
            projectId,
            requestId,
            executionPlan,
            executionScoreUri
        });
    }
}
