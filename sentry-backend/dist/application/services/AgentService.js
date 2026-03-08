"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentService = void 0;
class AgentService {
    constructor(sandboxProvider, projectRepo) {
        this.sandboxProvider = sandboxProvider;
        this.projectRepo = projectRepo;
    }
    /**
     * Triggers the AI Agent to profile new data and generate analytical queries.
     * This demonstrates how we send the "guide" or "prompt" to the agent.
     */
    async runDataProfilerAgent(tenantId, projectId, dataUri) {
        console.log(`[AgentService] Starting Profiler Agent for Project ${projectId}...`);
        // 1. We start a secure sandbox environment. The API Keys for OpenAI/Anthropic
        // are injected as environment variables behind the scenes.
        const sandboxId = await this.sandboxProvider.startSandbox();
        // 2. We construct the prompt (the "guide") in plain text.
        // This tells the LLM what its job is for this specific project.
        const systemPrompt = `
You are a Staff Data Engineer. Your goal is to analyze the Parquet file located at "${dataUri}".
1. Read the schema of the Parquet file.
2. Generate 3 useful SQL aggregations compatible with DuckDB that a business user would want to see.
3. Output ONLY a valid JSON array matching this format: [{ "widgetId": "string", "sqlString": "string" }]
`;
        // 3. We construct the actual Python script that the Sandbox will execute.
        // Notice how it reads `os.environ` for the API key, but takes the prompt directly.
        // We inject the prompt dynamically into the script string.
        const agentScript = `
import os
import duckdb
import json
from openai import OpenAI

# The key was securely injected by our Node.js Backend via env vars
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

prompt = \"\"\"${systemPrompt}\"\"\"

def analyze_data():
    try:
        # Agent has access to internet/storage if configured, or we downloaded the file beforehand
        # For simplicity, we assume DuckDB can read the URI directly (e.g., s3://...)
        
        # Example of Agent running an initial query to understand the data
        con = duckdb.connect(database=':memory:')
        schema_info = con.execute(f"DESCRIBE SELECT * FROM '{dataUri}'").fetchall()
        
        # Pass schema to LLM to generate queries
        completion = client.chat.completions.create(
            model="gpt-4-turbo",
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": f"Here is the database schema: {schema_info}"}
            ]
        )
        
        result = completion.choices[0].message.content
        print(f"AGENT_RESULT:{result}")
        
    except Exception as e:
        print(f"AGENT_ERROR:{str(e)}")

if __name__ == '__main__':
    analyze_data()
`;
        try {
            // 4. We send the script (which contains the prompt) to the sandbox to be executed.
            console.log(`[AgentService] Sending script and prompt to Sandbox ${sandboxId}...`);
            const execution = await this.sandboxProvider.executeTask(sandboxId, agentScript);
            if (execution.success) {
                // Parse the output from the agent
                const resultLine = execution.logs.split('\\n').find(line => line.startsWith('AGENT_RESULT:'));
                if (resultLine) {
                    const jsonString = resultLine.replace('AGENT_RESULT:', '').trim();
                    const generatedQueries = JSON.parse(jsonString);
                    // Save the generated queries back to our Database!
                    await this.saveGeneratedQueries(tenantId, projectId, generatedQueries);
                    console.log(`[AgentService] Successfully saved ${generatedQueries.length} queries for ${projectId}`);
                }
            }
            else {
                console.error(`[AgentService] Agent execution failed:`, execution.error, execution.logs);
            }
        }
        catch (error) {
            console.error(`[AgentService] Fatal error during agent execution:`, error);
        }
        finally {
            // 5. Always securely destroy the sandbox afterwards
            await this.sandboxProvider.stopSandbox(sandboxId);
        }
    }
    async saveGeneratedQueries(tenantId, projectId, queries) {
        const project = await this.projectRepo.findOne(tenantId, projectId);
        if (project) {
            project.queryConfigs = queries;
            project.status = 'active'; // Mark as ready
            await this.projectRepo.createOrUpdate(project);
        }
    }
}
exports.AgentService = AgentService;
