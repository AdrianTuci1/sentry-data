
import { initContainer } from '../src/core/container';

async function testAgentOutput() {
    const c = initContainer();
    const orch = c.instances.orchestrationService;

    const tenantId = 'test_tenant_1';
    const projectId = 'proj_ga4_demo';
    const goldUri = 's3://statsparrot-data/tenants/test_tenant_1/projects/proj_ga4_demo/gold/gold_layer.parquet';

    console.log("--- TESTING QUERY GENERATOR AGENT ---");

    try {
        const result = await (orch as any).executeAgentTask(
            tenantId,
            projectId,
            'Query_Generator',
            'system/boilerplates/prompts/query_generator.txt',
            'system/boilerplates/tasks/query_generator.py',
            {
                'INJECTED_GOLD_URI': goldUri,
                'INJECTED_MANIFEST_URI': 's3://statsparrot-data/system/manifest.yml'
            }
        );

        console.log("AGENT RESULT:", JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("AGENT FAILED:", e);
    }
}

testAgentOutput();
