import { DynamoDBClient, ScanCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { config } from '../src/config';

async function cleanup() {
    console.log('--- FULL CLEANUP: DYNAMODB & R2 ---');

    // 1. Initialize Clients
    const ddbClient = new DynamoDBClient({
        region: config.aws.region,
        credentials: {
            accessKeyId: config.aws.accessKeyId,
            secretAccessKey: config.aws.secretAccessKey
        }
    });

    const s3Client = new S3Client({
        region: 'auto',
        endpoint: config.r2.endpoint.replace(/\/$/, ""),
        credentials: {
            accessKeyId: config.r2.accessKeyId,
            secretAccessKey: config.r2.secretAccessKey,
        },
    });

    try {
        // --- CLEANUP DYNAMODB ---
        console.log(`[DB] Scanning and cleaning table: ${config.aws.dynamoTable}...`);
        const scanResult = await ddbClient.send(new ScanCommand({
            TableName: config.aws.dynamoTable
        }));

        if (scanResult.Items && scanResult.Items.length > 0) {
            console.log(`[DB] Found ${scanResult.Items.length} items. Deleting...`);
            for (const item of scanResult.Items) {
                await ddbClient.send(new DeleteItemCommand({
                    TableName: config.aws.dynamoTable,
                    Key: {
                        PK: item.PK,
                        SK: item.SK
                    }
                }));
            }
        } else {
            console.log('[DB] Table is already empty.');
        }

        // --- CLEANUP R2 ---
        console.log(`[R2] Cleaning bucket: ${config.r2.bucketData}...`);
        const listResult = await s3Client.send(new ListObjectsV2Command({
            Bucket: config.r2.bucketData
        }));

        if (listResult.Contents && listResult.Contents.length > 0) {
            console.log(`[R2] Found ${listResult.Contents.length} objects. Deleting...`);
            const deleteParams = {
                Bucket: config.r2.bucketData,
                Delete: {
                    Objects: listResult.Contents.map(obj => ({ Key: obj.Key }))
                }
            };
            await s3Client.send(new DeleteObjectsCommand(deleteParams));
        } else {
            console.log('[R2] Bucket is already empty.');
        }

        console.log('\n--- CLEANUP COMPLETE ---');

    } catch (error) {
        console.error('Cleanup failed:', error);
        process.exit(1);
    }
}

cleanup();
