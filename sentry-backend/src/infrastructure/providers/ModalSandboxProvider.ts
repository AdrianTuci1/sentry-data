import { ISandboxProvider, ISandboxConfig, IExecutionResult } from './ISandboxProvider';
import { config } from '../../config';

export class ModalSandboxProvider implements ISandboxProvider {
    constructor() {
        if (!config.providers.modalApiKey) {
            console.warn('[ModalSandbox] Warning: MODAL_API_KEY is not defined.');
        }
    }

    public async startSandbox(sandboxConfig?: ISandboxConfig): Promise<string> {
        console.log('[ModalSandbox] Spawning a new Sandbox via Modal App...');
        // Modal doesn't have a long-lived "socket" sandbox out of the box like E2B,
        // so starting a sandbox might just mean authenticating and preparing a call ID.
        // We simulate returning an execution context ID here.
        const sandboxId = `modal-sb-${Date.now()}`;
        return sandboxId;
    }

    public async executeTask(sandboxId: string, script: string): Promise<IExecutionResult> {
        console.log(`[ModalSandbox] Triggering ephemeral execution on Modal for ID: ${sandboxId}...`);

        try {
            // Actual implementation would be a REST call to a deployed Modal Webhook 
            // that accepts Python code and runs it securely in its own container.

            const req = await fetch('https://your-modal-workspace.modal.run/sandbox-executor', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.providers.modalApiKey}`
                },
                body: JSON.stringify({ script, sandboxId })
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
        // If modal containers are ephemeral, this might just clean up tmp files in R2 
        // or signify to the modal app that the session is closed.
    }
}
