// src/application/pipeline/PipelineConfig.ts

export const PipelineConfig = {
    /**
     * Development Overrides
     * Use these to bypass normal resolution logic during testing/debugging.
     */
    
    // If true, the system will ALWAYS execute the HotPathRunner regardless of schema changes.
    // Useful to save LLM tokens when you are just debugging the backend flow.
    FORCE_HOT_PATH_FOR_DEBUG: process.env.FORCE_HOT_PATH === 'true',

    // If true, the system will ALWAYS run the ColdPathRunner to force schema re-discovery.
    // Useful when you know the schema changed but the fingerprinting algorithm missed it.
    FORCE_COLD_PATH_FOR_DEBUG: process.env.FORCE_COLD_PATH === 'true',

    // Toggle the ML Path entirely. Set to false to disable all Machine Learning agents.
    ENABLE_ML_PATH: process.env.DISABLE_ML_PATH !== 'true',

    // If true, outputs more verbose logs from the AgentExecutor about the microVM state.
    VERBOSE_LOGGING: process.env.VERBOSE_LOGGING === 'true' || true, // default to true for development phase
};
