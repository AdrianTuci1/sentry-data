import { S3Client, ListMultipartUploadsCommand, AbortMultipartUploadCommand } from '@aws-sdk/client-s3';
import { config } from '../src/config';

async function abortUploads() {
    const client = new S3Client({
        region: 'auto',
        endpoint: config.r2.endpoint,
        credentials: {
            accessKeyId: config.r2.accessKeyId,
            secretAccessKey: config.r2.secretAccessKey,
        },
    });

    const bucket = config.r2.bucketData;
    const prefix = 'tenants/test_tenant_1/projects/proj_ga4_demo/gold/gold_layer.parquet';

    console.log(`Checking for multipart uploads in bucket: ${bucket} with prefix: ${prefix}`);

    try {
        const listCommand = new ListMultipartUploadsCommand({
            Bucket: bucket,
            Prefix: prefix
        });

        const response = await client.send(listCommand);

        if (!response.Uploads || response.Uploads.length === 0) {
            console.log('No active multipart uploads found.');
            return;
        }

        for (const upload of response.Uploads) {
            console.log(`Aborting upload: ${upload.Key}, UploadId: ${upload.UploadId}`);
            await client.send(new AbortMultipartUploadCommand({
                Bucket: bucket,
                Key: upload.Key,
                UploadId: upload.UploadId
            }));
        }

        console.log('Successfully aborted all matching multipart uploads.');
    } catch (error) {
        console.error('Error aborting uploads:', error);
    }
}

abortUploads();
