export interface ISandboxConfig {
    envVars?: Record<string, string>;
    timeoutMs?: number;
    // Any other parameters required generically
}

export interface IExecutionResult {
    success: boolean;
    logs: string;
    error?: string;
    artifacts?: any;
}

export interface ISandboxProvider {
    /**
     * Initializes a new sandbox instance.
     * @returns ID of the created sandbox.
     */
    startSandbox(config?: ISandboxConfig): Promise<string>;

    /**
     * Executes arbitrary code or a predefined logic block inside the sandbox.
     * @param sandboxId The ID of the running sandbox.
     * @param script Content or instructions to be run.
     */
    executeTask(sandboxId: string, script: string): Promise<IExecutionResult>;

    /**
     * Forcibly stops and cleans up the sandbox environment.
     * @param sandboxId Instance to stop.
     */
    stopSandbox(sandboxId: string): Promise<void>;
}
