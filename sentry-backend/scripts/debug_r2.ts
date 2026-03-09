import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { config } from '../src/config';

async function listObjects() {
    console.log('--- DEBUG: LISTING R2 OBJECTS ---');
    console.log('Bucket:', config.r2.bucketData);

    const s3Client = new S3Client({
        region: 'auto',
        endpoint: config.r2.endpoint,
        credentials: {
            accessKeyId: config.r2.accessKeyId,
            secretAccessKey: config.r2.secretAccessKey,
        },
    });

    try {
        const response = await s3Client.send(new ListObjectsV2Command({
            Bucket: config.r2.bucketData
        }));
        console.log('Available Objects:');
        response.Contents?.forEach(o => console.log(` - ${o.Key} (Size: ${o.Size})`));
    } catch (err) {
        console.error('Failed to list objects:', err);
    }
}

listObjects();
