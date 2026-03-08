"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.E2BSandboxProvider = void 0;
const e2b_1 = require("e2b");
const config_1 = require("../../config");
class E2BSandboxProvider {
    constructor() {
        this.activeSandboxes = new Map();
        if (!config_1.config.providers.e2bApiKey) {
            console.warn('[E2BSandbox] Warning: E2B_API_KEY is not defined in environment variables.');
        }
    }
    async startSandbox(sandboxConfig) {
        console.log('[E2BSandbox] Starting new sandbox session...');
        const sandboxOpts = {
            apiKey: config_1.config.providers.e2bApiKey,
            envVars: {
                // By default, inject our LLM Keys from the Central Backend's context
                // into the secure Sandbox context so external scripts can authenticate
                OPENAI_API_KEY: config_1.config.llm.openaiApiKey,
                ANTHROPIC_API_KEY: config_1.config.llm.anthropicApiKey,
                ...(sandboxConfig?.envVars || {})
            }
        };
        const sandbox = await e2b_1.Sandbox.create(sandboxOpts);
        this.activeSandboxes.set(sandbox.sandboxId, sandbox);
        console.log(`[E2BSandbox] Sandbox started with ID: ${sandbox.sandboxId}`);
        return sandbox.sandboxId;
    }
    async executeTask(sandboxId, script) {
        const sandbox = this.activeSandboxes.get(sandboxId);
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
        }
        catch (error) {
            return {
                success: false,
                logs: '',
                error: error.message
            };
        }
    }
    async stopSandbox(sandboxId) {
        const sandbox = this.activeSandboxes.get(sandboxId);
        if (sandbox) {
            await sandbox.kill();
            this.activeSandboxes.delete(sandboxId);
            console.log(`[E2BSandbox] Sandbox ${sandboxId} terminated.`);
        }
    }
}
exports.E2BSandboxProvider = E2BSandboxProvider;
