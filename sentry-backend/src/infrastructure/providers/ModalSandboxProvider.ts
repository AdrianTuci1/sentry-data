import { ISandboxProvider, ISandboxConfig, IExecutionResult } from './ISandboxProvider';
import { config } from '../../config';

export class ModalSandboxProvider implements ISandboxProvider {
    private activeSandboxes: Map<string, Record<string, string>> = new Map();

    constructor() {
        if (!config.providers.modalTokenId || !config.providers.modalTokenSecret) {
            console.warn('[ModalSandbox] Warning: MODAL_TOKEN_ID or MODAL_TOKEN_SECRET is not defined.');
        }
    }

    public async startSandbox(sandboxConfig?: ISandboxConfig): Promise<string> {
        console.log('[ModalSandbox] Spawning a new Sandbox via Modal App...');
        // Modal doesn't have a long-lived "socket" sandbox out of the box like E2B,
        // so starting a sandbox might just mean authenticating and preparing a call ID.
        // We simulate returning an execution context ID here.
        const sandboxId = `modal-sb-${Date.now()}`;

        if (sandboxConfig?.envVars) {
            this.activeSandboxes.set(sandboxId, sandboxConfig.envVars);
        }

        return sandboxId;
    }

    public async executeTask(sandboxId: string, script: string): Promise<IExecutionResult> {
        console.log(`[ModalSandbox] Triggering ephemeral execution on Modal for ID: ${sandboxId}...`);

        const envVars = this.activeSandboxes.get(sandboxId) || {};

        try {
            // Actual implementation would be a REST call to a deployed Modal Webhook 
            // that accepts Python code and runs it securely in its own container.

            const req = await fetch('https://adrian-tucicovenco--sentry-sandbox-executor-sandbox-executor.modal.run', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.providers.modalTokenId}:${config.providers.modalTokenSecret}`
                },
                body: JSON.stringify({ script, sandboxId, envVars })
            });

            if (!req.ok) {
                throw new Error(`Modal Execution HTTP Error: ${req.status}`);
            }

            const response = await req.json();

            return {
                success: response.success,
                logs: response.logs || '',
                error: response.error
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
        console.log(`[ModalSandbox] Cleaning up execution artifacts for Modal Sandbox ${sandboxId}.`);
        this.activeSandboxes.delete(sandboxId);
    }
}
