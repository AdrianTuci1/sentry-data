import { initContainer } from '../src/core/container';

async function testRuntime() {
    const container = initContainer();
    const orchestrator = container.instances.orchestrationService;
    const sourceRepo = container.instances.sourceRepo;

    const tenantId = 'test_tenant_1';
    const projectId = 'proj_ecommerce_demo';

    try {
        console.log(`Starting runtime testing for project ${projectId}...`);
        
        // Fetch real sources from the database instead of hardcoding
        let sources = await sourceRepo.findAllForProject(tenantId, projectId);
        
        if (sources.length === 0) {
            console.error(`[Test] No sources found for project ${projectId} in DynamoDB. Please run "npm run seed" first.`);
            return;
        }

        const rawSourceUris = sources.map(s => s.uri);
        const sourceNames = sources.map(s => s.name);

        console.log(`[Test] Found ${sources.length} sources. Triggering runtime...`);

        
        await orchestrator.runRuntime(tenantId, projectId, rawSourceUris, sourceNames);
        
        console.log("Runtime finished!");
    } catch (err) {
        console.error("Runtime crashed:", err);
    }
}
testRuntime();
