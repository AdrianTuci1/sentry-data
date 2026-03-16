// src/application/pipeline/PipelineConfig.ts

export const PipelineConfig = {
    // Toggle the ML Path entirely. Set to false to disable all Machine Learning agents.
    ENABLE_ML_PATH: process.env.DISABLE_ML_PATH !== 'true',

    // If true, outputs more verbose logs from the AgentExecutor about the microVM state.
    VERBOSE_LOGGING: process.env.VERBOSE_LOGGING === 'true' || true, // default to true for development phase
};
