import { DynamoDBClient, ScanCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { config } from '../src/config';
import { deleteAllObjects, deletePrefix, R2_SYSTEM_PREFIX, SENTINEL_MODEL_BUNDLE_PREFIX, SENTINEL_TRAINING_BUNDLE_PREFIX, WIDGETS_BUCKET_PREFIX } from './lib/r2_artifacts';

const configuredPrefixes = (process.env.CLEAN_R2_PREFIXES || '')
    .split(',')
    .map((prefix) => prefix.trim())
    .filter(Boolean);

const preserveSystemArtifacts = ['1', 'true', 'yes'].includes((process.env.PRESERVE_R2_SYSTEM || '').toLowerCase());

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
        let lastEvaluatedKey: Record<string, any> | undefined;
        let deletedDbItems = 0;

        do {
            const scanResult = await ddbClient.send(new ScanCommand({
                TableName: config.aws.dynamoTable,
                ExclusiveStartKey: lastEvaluatedKey
            }));

            const items = scanResult.Items || [];
            if (items.length > 0) {
                console.log(`[DB] Found ${items.length} item(s). Deleting...`);
            }

            for (const item of items) {
                await ddbClient.send(new DeleteItemCommand({
                    TableName: config.aws.dynamoTable,
                    Key: {
                        PK: item.PK,
                        SK: item.SK
                    }
                }));
                deletedDbItems += 1;
            }

            lastEvaluatedKey = scanResult.LastEvaluatedKey;
        } while (lastEvaluatedKey);

        if (deletedDbItems === 0) {
            console.log('[DB] Table is already empty.');
        } else {
            console.log(`[DB] Deleted ${deletedDbItems} item(s).`);
        }

        // --- CLEANUP R2 ---
        console.log(`[R2] Cleaning bucket: ${config.r2.bucketData}...`);

        let deletedR2Objects = 0;
        if (configuredPrefixes.length > 0) {
            console.log(`[R2] Cleaning configured prefix list: ${configuredPrefixes.join(', ')}`);
            for (const prefix of configuredPrefixes) {
                deletedR2Objects += await deletePrefix(config.r2.bucketData, prefix, s3Client);
            }
        } else if (preserveSystemArtifacts) {
            console.log(`[R2] PRESERVE_R2_SYSTEM enabled. Keeping ${R2_SYSTEM_PREFIX}/ including:`);
            console.log(`     - ${WIDGETS_BUCKET_PREFIX}`);
            console.log(`     - ${SENTINEL_TRAINING_BUNDLE_PREFIX}`);
            console.log(`     - ${SENTINEL_MODEL_BUNDLE_PREFIX}`);
            for (const prefix of ['tenants', 'feedback', 'runtime']) {
                deletedR2Objects += await deletePrefix(config.r2.bucketData, prefix, s3Client);
            }
        } else {
            deletedR2Objects = await deleteAllObjects(config.r2.bucketData, s3Client);
        }

        console.log(deletedR2Objects === 0 ? '[R2] Bucket/prefixes are already empty.' : `[R2] Deleted ${deletedR2Objects} object(s).`);

        console.log('\n--- CLEANUP COMPLETE ---');

    } catch (error) {
        console.error('Cleanup failed:', error);
        process.exit(1);
    }
}

cleanup();
