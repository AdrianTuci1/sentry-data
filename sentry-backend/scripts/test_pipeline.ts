import { initContainer } from '../src/core/container';

async function testPipeline() {
    const container = initContainer();
    const orchestrator = container.instances.orchestrationService;
    const sourceRepo = container.instances.sourceRepo;

    const tenantId = 'test_tenant_1';
    const projectId = 'proj_ecommerce_demo';

    try {
        console.log(`Starting pipeline testing for project ${projectId}...`);
        
        // Fetch real sources from the database instead of hardcoding
        let sources = await sourceRepo.findAllForProject(tenantId, projectId);
        
        // Filter to just Olist Orders to ensure the pipeline finishes in time
        // for an end-to-end sandbox test without hitting the 5-step timeout on 9 sources.
        sources = sources.filter(s => s.name === 'Olist Orders');
        
        if (sources.length === 0) {
            console.error(`[Test] No 'Olist Orders' source found for ${projectId} in DynamoDB. Please run "npm run seed" first.`);
            return;
        }

        const rawSourceUris = sources.map(s => s.uri);
        const sourceNames = sources.map(s => s.name);

        console.log(`[Test] Found ${sources.length} sources. Triggering pipeline...`);

        
        await orchestrator.runFullPipeline(tenantId, projectId, rawSourceUris, sourceNames);
        
        console.log("Pipeline finished!");
    } catch (err) {
        console.error("Pipeline crashed:", err);
    }
}
testPipeline();
