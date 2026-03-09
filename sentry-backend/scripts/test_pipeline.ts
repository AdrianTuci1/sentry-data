import { initContainer } from '../src/core/container';

async function testPipeline() {
    const container = initContainer();
    const orchestrator = container.instances.orchestrationService;
    
    try {
        console.log("Starting pipeline testing...");
        await orchestrator.runFullPipeline('test_tenant_1', 'proj_ga4_demo', [
            's3://statsparrot-data/tenants/test_tenant_1/projects/proj_ga4_demo/bronze/ga4_export.parquet'
        ]);
        console.log("Pipeline finished!");
    } catch(err) {
        console.error("Pipeline crashed:", err);
    }
}
testPipeline();
