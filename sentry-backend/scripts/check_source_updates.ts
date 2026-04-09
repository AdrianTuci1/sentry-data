import { initContainer } from '../src/core/container';

async function main() {
    const tenantId = process.argv[2];
    const projectId = process.argv[3];

    if (!tenantId) {
        console.error('Usage: ts-node scripts/check_source_updates.ts <tenantId> [projectId]');
        process.exit(1);
    }

    const container = initContainer();
    const monitor = container.instances.sourceUpdateMonitorService;

    const result = projectId
        ? await monitor.scanProjectSources(tenantId, projectId)
        : await monitor.scanTenantSources(tenantId);

    console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
