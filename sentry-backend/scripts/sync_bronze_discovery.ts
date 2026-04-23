import { initContainer } from '../src/core/container';
import { v4 as uuidv4 } from 'uuid';
import { ObjectStorageConfig } from '../src/types/storage';
import { config } from '../src/config';

async function main() {
    const tenantId = process.argv[2] || 'test_tenant_1';
    const projectId = process.argv[3] || 'proj_ecommerce_demo';

    console.log('══════════════════════════════════════════');
    console.log('  BRONZE SOURCE DISCOVERY & TRIGGER');
    console.log('══════════════════════════════════════════\n');

    const container = initContainer();
    const sourceRepo = container.instances.sourceRepo;
    const objectStorageService = container.instances.objectStorageService;
    const orchestrationService = container.instances.orchestrationService;

    // We scan the 'bronze' prefix for this project
    const discoveryPrefix = `tenants/${tenantId}/projects/${projectId}/bronze/`;
    const bucket = config.r2.bucketData;

    console.log(`[Discovery] Scanning R2 bucket "${bucket}" at prefix: ${discoveryPrefix}...`);

    const storageConfig: ObjectStorageConfig = {
        provider: 'r2',
        bucket: bucket,
        prefix: discoveryPrefix,
        fileFormat: 'parquet'
    };

    try {
        const discovered = await objectStorageService.discoverSources(storageConfig);
        console.log(`[Discovery] Found ${discovered.length} candidate source(s).\n`);

        const existingSources = await sourceRepo.findAllForProject(tenantId, projectId);
        const existingUris = new Set(existingSources.map(s => s.uri));

        const sourceUris: string[] = [];
        const sourceNames: string[] = [];

        for (const item of discovered) {
            // Check if already registered
            if (existingUris.has(item.uri)) {
                console.log(`[DB]   - Source "${item.sourceName}" already exists. Skipping registration.`);
                sourceUris.push(item.uri);
                sourceNames.push(item.sourceName);
                continue;
            }

            const sourceId = uuidv4();
            console.log(`[DB]   + Registering NEW source: "${item.sourceName}"`);
            console.log(`         URI: ${item.uri}`);

            await sourceRepo.createOrUpdate({
                tenantId,
                projectId,
                sourceId,
                name: item.sourceName,
                uri: item.uri,
                type: item.fileFormat || 'parquet',
                createdAt: new Date().toISOString(),
                storageConfig: {
                    ...storageConfig,
                    prefix: item.prefix
                }
            });

            sourceUris.push(item.uri);
            sourceNames.push(item.sourceName);
        }

        if (sourceUris.length > 0) {
            console.log(`\n[PNE] Triggering Autonomous Pipeline for ${sourceUris.length} sources...`);
            await orchestrationService.runRuntime(tenantId, projectId, sourceUris, sourceNames);
            console.log('[PNE] Runtime triggered successfully!');
        } else {
            console.log('\n[Discovery] No sources found to process.');
        }

    } catch (error) {
        console.error('\n[Discovery] Failed:', error);
        process.exit(1);
    }
}

main().catch(console.error);
