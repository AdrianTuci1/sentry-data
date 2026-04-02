import { ParrotExecutionPlan, ParrotExecutionSubmission } from '../../types/parrot';

export interface ExecutionSubmitRequest {
    tenantId: string;
    projectId: string;
    requestId: string;
    executionPlan: ParrotExecutionPlan;
    executionScoreUri: string;
}

export interface ExecutionProvider {
    readonly engine: ParrotExecutionPlan['engine'];
    submit(request: ExecutionSubmitRequest): Promise<ParrotExecutionSubmission>;
}
