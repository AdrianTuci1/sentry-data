import { initContainer } from '../src/core/container';

async function verifyAssets() {
    const container = initContainer();
    const r2 = container.instances.r2StorageService;
    const bucket = process.env.R2_DATA_BUCKET || 'statsparrot-data';
    const tenantId = 'test_tenant_1';
    const projectId = 'proj_ga4_demo';

    const assets = [
        `tenants/${tenantId}/projects/${projectId}/silver/normalized_source_0.parquet`,
        `tenants/${tenantId}/projects/${projectId}/gold/gold_layer.parquet`,
        `tenants/${tenantId}/projects/${projectId}/gold/predictions_initial.parquet`,
        `tenants/${tenantId}/projects/${projectId}/system/logs/Normalization_Source_0.log`,
        `tenants/${tenantId}/projects/${projectId}/system/logs/Feature_Engineering.log`,
    ];

    console.log('--- VERIFYING R2 ASSETS ---');
    for (const key of assets) {
        try {
            await r2['client'].send(new (await import('@aws-sdk/client-s3')).HeadObjectCommand({
                Bucket: bucket,
                Key: key
            }));
            console.log(`[OK] ${key}`);
        } catch (err) {
            console.error(`[MISSING] ${key}`);
        }
    }
}

verifyAssets();
