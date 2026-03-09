import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../src/config';

async function deleteCache() {
    const s3Client = new S3Client({
        region: 'auto',
        endpoint: config.r2.endpoint,
        credentials: {
            accessKeyId: config.r2.accessKeyId,
            secretAccessKey: config.r2.secretAccessKey,
        },
    });

    try {
        await s3Client.send(new DeleteObjectCommand({
            Bucket: config.r2.bucketData,
            Key: 'tenants/test_tenant_1/projects/proj_ga4_demo/system/scripts/Query_Generator.py'
        }));
        await s3Client.send(new DeleteObjectCommand({
            Bucket: config.r2.bucketData,
            Key: 'tenants/test_tenant_1/projects/proj_ga4_demo/system/scripts/ML_Trainer.py'
        }));
        console.log('Cache scripts deleted.');
    } catch (err) {
        console.error('Failed to delete objects:', err);
    }
}
deleteCache();
