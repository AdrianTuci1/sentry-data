import { AgentTaskParams } from '../types';

export interface AgentTaskStrategy {
    getTemplateName(): string;
    getCommand(): string;
    getEnvVars(params: AgentTaskParams): Record<string, string>;
}

export class DefaultAgentTaskStrategy implements AgentTaskStrategy {
    public getTemplateName(): string {
        return 'sentry-agent-v1';
    }

    public getCommand(): string {
        return 'python /root/agent_manager.py';
    }

    public getEnvVars(params: AgentTaskParams): Record<string, string> {
        return {
            'tenantId': params.tenantId,
            'projectId': params.projectId,
            'taskName': params.taskName,
            'SENTINEL_GOALS': params.sentinelGoals ? JSON.stringify(params.sentinelGoals) : '[]'
        };
    }
}
