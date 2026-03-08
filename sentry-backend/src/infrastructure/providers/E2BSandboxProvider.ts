import { Sandbox } from 'e2b';
import { ISandboxProvider, ISandboxConfig, IExecutionResult } from './ISandboxProvider';
import { config } from '../../config';

export class E2BSandboxProvider implements ISandboxProvider {
    private activeSandboxes: Map<string, Sandbox> = new Map();

    constructor() {
        if (!config.providers.e2bApiKey) {
            console.warn('[E2BSandbox] Warning: E2B_API_KEY is not defined in environment variables.');
        }
    }

    public async startSandbox(sandboxConfig?: ISandboxConfig): Promise<string> {
        console.log('[E2BSandbox] Starting new sandbox session...');

        const sandboxOpts: any = {
            apiKey: config.providers.e2bApiKey,
            envVars: {
                // By default, inject our LLM Keys from the Central Backend's context
                // into the secure Sandbox context so external scripts can authenticate
                OPENAI_API_KEY: config.llm.openaiApiKey,
                ANTHROPIC_API_KEY: config.llm.anthropicApiKey,
                ...(sandboxConfig?.envVars || {})
            }
        };

        const sandbox = await Sandbox.create(sandboxOpts);

        this.activeSandboxes.set(sandbox.sandboxId, sandbox);
        console.log(`[E2BSandbox] Sandbox started with ID: ${sandbox.sandboxId}`);
        return sandbox.sandboxId;
    }

    public async executeTask(sandboxId: string, script: string): Promise<IExecutionResult> {
        const sandbox: any = this.activeSandboxes.get(sandboxId);

        if (!sandbox) {
            throw new Error(`[E2BSandbox] Sandbox ${sandboxId} not found or inactive.`);
        }

        console.log(`[E2BSandbox] Executing task on Sandbox ${sandboxId}...`);

        try {
            // Write script to a file and execute it.
            await sandbox.filesystem.write('/home/user/task.py', script);
            const execution = await sandbox.process.startAndWait('python /home/user/task.py');

            return {
                success: execution.exitCode === 0,
                logs: execution.stdout + '\n' + execution.stderr,
                error: execution.exitCode !== 0 ? 'Execution failed' : undefined
            };
        } catch (error: any) {
            return {
                success: false,
                logs: '',
                error: error.message
            };
        }
    }

    public async stopSandbox(sandboxId: string): Promise<void> {
        const sandbox = this.activeSandboxes.get(sandboxId);
        if (sandbox) {
            await sandbox.kill();
            this.activeSandboxes.delete(sandboxId);
            console.log(`[E2BSandbox] Sandbox ${sandboxId} terminated.`);
        }
    }
}
