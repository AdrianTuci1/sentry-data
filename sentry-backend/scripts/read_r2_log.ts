import { initContainer } from '../src/core/container';

async function readR2Log(taskName: string) {
    const container = initContainer();
    const r2 = container.instances.r2StorageService;
    const bucket = process.env.R2_DATA_BUCKET || 'statsparrot-data';
    const key = `tenants/test_tenant_1/projects/proj_ga4_demo/system/logs/${taskName}.log`;

    try {
        const response = await r2['client'].send(new (await import('@aws-sdk/client-s3')).GetObjectCommand({
            Bucket: bucket,
            Key: key
        }));
        const content = await response.Body?.transformToString();
        console.log(`--- LOG FOR ${taskName} ---`);
        console.log(content);
        console.log('--- END LOG ---');
    } catch (err) {
        console.error(`Failed to read log for ${taskName}:`, err);
    }
}

const task = process.argv[2] || 'Feature_Engineering';
readR2Log(task);
