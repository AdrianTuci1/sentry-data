import { initContainer } from '../src/core/container';
import dotenv from 'dotenv';

dotenv.config();

async function debugStep2() {
    const container = initContainer();
    const orch = container.instances.orchestrationService;
    const projectRepo = container.instances.projectRepo;
    const r2Service = container.instances.r2StorageService;

    const tenantId = "test_tenant_1";
    const projectId = "proj_ga4_demo";
    const normalizedUris = [
        `s3://${process.env.R2_BUCKET_DATA || 'statsparrot-data'}/tenants/${tenantId}/projects/${projectId}/silver/normalized_source_0.parquet`
    ];

    console.log("--- DEBUG STEP 2: FEATURE ENGINEERING ---");

    const systemPromptUri = `s3://${process.env.R2_BUCKET_DATA || 'statsparrot-data'}/system/boilerplates/prompts/feature_engineer.txt`;
    const boilerplateUri = `s3://${process.env.R2_BUCKET_DATA || 'statsparrot-data'}/system/boilerplates/tasks/feature_engineer.py`;
    const goldTableUri = r2Service.getS3Uri(tenantId, projectId, 'gold', 'gold_layer.parquet');

    // @ts-ignore - access private for debug
    const result = await orch.executeAgentTask(
        tenantId,
        projectId,
        "Feature_Engineering",
        systemPromptUri,
        boilerplateUri,
        {
            'INJECTED_DATA_URIS': JSON.stringify(normalizedUris),
            'TARGET_GOLD_URI': goldTableUri
        }
    );

    console.log("Discovery captured:", JSON.stringify(result.discovery, null, 2));

    if (result.discovery) {
        console.log("Saving to DynamoDB manually for verification...");
        const project = await projectRepo.findById(tenantId, projectId);
        if (project) {
            project.discoveryMetadata = {
                tables: [],
                metricGroups: [result.discovery],
                predictionModels: [],
                dashboards: []
            };
            await projectRepo.createOrUpdate(project);
            console.log("Save complete.");
        }
    }
}

debugStep2().catch(console.error);
