import { DeleteObjectsCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import { config } from '../../src/config';

export type Logger = Pick<typeof console, 'log' | 'error' | 'warn'>;

export const REPO_ROOT = path.resolve(__dirname, '../../..');
export const R2_SYSTEM_PREFIX = process.env.R2_SYSTEM_PREFIX || 'system/r2-system';
export const WIDGETS_BUCKET_PREFIX = process.env.WIDGETS_BUCKET_PREFIX || path.posix.join(R2_SYSTEM_PREFIX, 'widgets');
export const SENTINEL_TRAINING_BUNDLE_PREFIX = process.env.SENTINEL_TRAINING_BUNDLE_PREFIX || path.posix.join(R2_SYSTEM_PREFIX, 'training', 'sentinel', 'generated', 'latest');
export const SENTINEL_MODEL_BUNDLE_PREFIX = process.env.SENTINEL_MODEL_R2_PREFIX || path.posix.join(R2_SYSTEM_PREFIX, 'models', 'sentinel');

export function createR2Client(): S3Client {
    return new S3Client({
        region: config.r2.region || 'auto',
        endpoint: config.r2.endpoint.replace(/\/$/, ''),
        credentials: {
            accessKeyId: config.r2.accessKeyId,
            secretAccessKey: config.r2.secretAccessKey,
        },
    });
}

export function detectContentType(filePath: string): string {
    const extension = path.extname(filePath).toLowerCase();

    switch (extension) {
        case '.yml':
        case '.yaml':
            return 'application/yaml';
        case '.json':
            return 'application/json';
        case '.jsonl':
            return 'application/x-ndjson';
        case '.js':
        case '.mjs':
            return 'application/javascript';
        case '.jsx':
            return 'text/jsx';
        case '.css':
            return 'text/css';
        case '.csv':
            return 'text/csv';
        case '.md':
            return 'text/markdown';
        case '.parquet':
            return 'application/octet-stream';
        default:
            return 'application/octet-stream';
    }
}

export async function uploadDirectory(localDirPath: string, bucketPrefix: string, s3Client: S3Client, logger: Logger = console): Promise<void> {
    if (!fs.existsSync(localDirPath)) {
        throw new Error(`Directory not found: ${localDirPath}`);
    }

    const items = fs.readdirSync(localDirPath, { withFileTypes: true });
    for (const item of items) {
        const fullLocalPath = path.join(localDirPath, item.name);
        const bucketKey = path.posix.join(bucketPrefix, item.name);

        if (item.isDirectory()) {
            await uploadDirectory(fullLocalPath, bucketKey, s3Client, logger);
            continue;
        }

        if (!item.isFile()) {
            continue;
        }

        await s3Client.send(new PutObjectCommand({
            Bucket: config.r2.bucketData,
            Key: bucketKey,
            Body: fs.readFileSync(fullLocalPath),
            ContentType: detectContentType(fullLocalPath),
        }));

        logger.log(`[R2] Uploaded: ${bucketKey}`);
    }
}

export async function deletePrefix(bucket: string, prefix: string, s3Client: S3Client, logger: Logger = console): Promise<number> {
    let continuationToken: string | undefined;
    let deleted = 0;
    const normalizedPrefix = prefix.replace(/^\/+/, '').replace(/\/?$/, '/');

    do {
        const listResult = await s3Client.send(new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: normalizedPrefix,
            ContinuationToken: continuationToken,
        }));

        const objects = (listResult.Contents || [])
            .filter((item) => item.Key)
            .map((item) => ({ Key: item.Key! }));

        if (objects.length > 0) {
            await s3Client.send(new DeleteObjectsCommand({
                Bucket: bucket,
                Delete: { Objects: objects },
            }));
            deleted += objects.length;
            logger.log(`[R2] Deleted ${objects.length} object(s) under ${normalizedPrefix}`);
        }

        continuationToken = listResult.NextContinuationToken;
    } while (continuationToken);

    return deleted;
}

export async function deleteAllObjects(bucket: string, s3Client: S3Client, logger: Logger = console): Promise<number> {
    let continuationToken: string | undefined;
    let deleted = 0;

    do {
        const listResult = await s3Client.send(new ListObjectsV2Command({
            Bucket: bucket,
            ContinuationToken: continuationToken,
        }));

        const objects = (listResult.Contents || [])
            .filter((item) => item.Key)
            .map((item) => ({ Key: item.Key! }));

        if (objects.length > 0) {
            await s3Client.send(new DeleteObjectsCommand({
                Bucket: bucket,
                Delete: { Objects: objects },
            }));
            deleted += objects.length;
            logger.log(`[R2] Deleted ${objects.length} object(s).`);
        }

        continuationToken = listResult.NextContinuationToken;
    } while (continuationToken);

    return deleted;
}
