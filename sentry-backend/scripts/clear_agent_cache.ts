import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { config } from '../src/config';

async function clearProjectCache() {
    const s3Client = new S3Client({
        region: 'auto',
        endpoint: config.r2.endpoint.replace(/\/$/, ""),
        credentials: {
            accessKeyId: config.r2.accessKeyId,
            secretAccessKey: config.r2.secretAccessKey,
        },
    });

    const prefix = 'tenants/test_tenant_1/projects/proj_ga4_demo/system/scripts/';

    try {
        console.log(`Listing objects with prefix: ${prefix}`);
        const listResponse = await s3Client.send(new ListObjectsV2Command({
            Bucket: config.r2.bucketData,
            Prefix: prefix
        }));

        if (listResponse.Contents && listResponse.Contents.length > 0) {
            const deleteParams = {
                Bucket: config.r2.bucketData,
                Delete: {
                    Objects: listResponse.Contents.map(obj => ({ Key: obj.Key! }))
                }
            };
            await s3Client.send(new DeleteObjectsCommand(deleteParams));
            console.log(`Deleted ${listResponse.Contents.length} cached scripts.`);
        } else {
            console.log('No cached scripts found.');
        }
    } catch (err) {
        console.error('Failed to clear cache:', err);
    }
}

clearProjectCache();
