import { initContainer } from '../src/core/container';
import { v4 as uuidv4 } from 'uuid';

async function main() {
    const tenantId = 'test_tenant_1';
    const workspaceId = 'ws_test_tenant_1_main';
    const projectId = 'proj_ecommerce_demo';
    const projectName = 'E-commerce Demo (Parrot OS)';

    console.log(`[Bootstrap] registering project ${projectName} (${projectId}) for tenant ${tenantId}...`);

    const container = initContainer();
    const projectRepo = container.instances.projectRepo;

    // Check if exists
    const existing = await projectRepo.findById(tenantId, projectId);
    if (existing) {
        console.log(`[Bootstrap] Project ${projectId} already exists. Updating...`);
    }

    await projectRepo.createOrUpdate({
        tenantId,
        projectId,
        workspaceId,
        name: projectName,
        sourceType: 'custom',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        runtimeMode: 'parrot_os'
    });

    console.log('[Bootstrap] Project successfully registered in DynamoDB.');
}

main().catch(console.error);
