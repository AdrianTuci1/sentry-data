import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../src/config';

async function downloadCache() {
    const s3Client = new S3Client({
        region: 'auto',
        endpoint: config.r2.endpoint,
        credentials: {
            accessKeyId: config.r2.accessKeyId,
            secretAccessKey: config.r2.secretAccessKey,
        },
    });

    try {
        const response: any = await s3Client.send(new GetObjectCommand({
            Bucket: config.r2.bucketData,
            Key: 'tenants/test_tenant_1/projects/proj_ga4_demo/system/scripts/Feature_Engineering.py'
        }));
        
        const content = await response.Body?.transformToString();
        console.log("--- FEATURE ENGINEERING ---");
        console.log(content);
        
        const response2: any = await s3Client.send(new GetObjectCommand({
            Bucket: config.r2.bucketData,
            Key: 'tenants/test_tenant_1/projects/proj_ga4_demo/system/scripts/Normalization_Source_0.py'
        }));
        console.log("--- NORMALIZATION ---");
        const content2 = await response2.Body?.transformToString();
        console.log(content2);
    } catch (err) {
        console.error('Failed to get object:', err);
    }
}
downloadCache();
