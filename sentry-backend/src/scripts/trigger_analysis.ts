/**
 * COMMAND TO RUN:
 * npx ts-node src/scripts/trigger_analysis.ts
 */

import { initContainer } from '../core/container';
import { config } from '../config';

async function run() {
    console.log('══════════════════════════════════════════');
    console.log('       PNE FULL ANALYSIS TRIGGER');
    console.log('══════════════════════════════════════════');

    const args = process.argv.slice(2);
    const projectId = args.find(a => a.startsWith('--projectId='))?.split('=')[1] || 'proj_ecommerce_demo';
    const tenantId = args.find(a => a.startsWith('--tenantId='))?.split('=')[1] || 'test_tenant_1';

    try {
        console.log(`[DI] Initializing Application Container...`);
        const { instances } = initContainer();

        // We know the structure from full_reset.ts
        const datasets = ['Olist_Orders', 'Olist_Products', 'Olist_Reviews'];
        const rawSourceUris = datasets.map(d => 
            `s3://${config.r2.bucketData}/tenants/${tenantId}/projects/${projectId}/sources/${d}/**/*.parquet`
        );

        console.log(`[Orchestrator] Triggering full runtime loop for ${datasets.length} sources...`);
        
        // This will run bootstrap -> discovery -> projection planning -> query planning
        await (instances.orchestrationService as any).runRuntime(
            tenantId,
            projectId,
            rawSourceUris,
            datasets,
            [], // sourceDescriptors
            true // forceRediscover
        );
        
        console.log('\n══════════════════════════════════════════');
        console.log('  SUCCESS: FULL RUNTIME ORCHESTRATED');
        console.log('══════════════════════════════════════════');
        console.log(`[Info] Monitor Modal logs and Frontend MindMap.`);
        console.log('══════════════════════════════════════════\n');

    } catch (error: any) {
        console.error(`\n[FATAL ERROR]`);
        console.error(`Message:   ${error.message}`);
        process.exit(1);
    }
}

run();
