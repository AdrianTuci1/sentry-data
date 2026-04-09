import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { config } from '../../src/config';

type Logger = Pick<typeof console, 'log' | 'error'>;

interface DeployWidgetsOptions {
    s3Client?: S3Client;
    logger?: Logger;
    generateArtifacts?: boolean;
}

const REPO_ROOT = path.resolve(__dirname, '../../..');
const WIDGETS_LOCAL_DIR = path.join(REPO_ROOT, 'boilerplates', 'widgets');
const WIDGET_ARTIFACT_SCRIPT = path.join(WIDGETS_LOCAL_DIR, 'generate-artifacts.mjs');
const WIDGETS_BUCKET_PREFIX = 'system/boilerplates/widgets';

function detectContentType(filePath: string): string {
    const extension = path.extname(filePath).toLowerCase();

    switch (extension) {
        case '.yml':
        case '.yaml':
            return 'application/yaml';
        case '.json':
            return 'application/json';
        case '.js':
        case '.mjs':
            return 'application/javascript';
        case '.jsx':
            return 'text/jsx';
        case '.css':
            return 'text/css';
        case '.md':
            return 'text/markdown';
        default:
            return 'application/octet-stream';
    }
}

export function createR2Client(): S3Client {
    return new S3Client({
        region: 'auto',
        endpoint: config.r2.endpoint.replace(/\/$/, ''),
        credentials: {
            accessKeyId: config.r2.accessKeyId,
            secretAccessKey: config.r2.secretAccessKey,
        },
    });
}

export function generateWidgetArtifacts(logger: Logger = console): void {
    logger.log(`[widgets] Generating widget artifacts with ${path.relative(REPO_ROOT, WIDGET_ARTIFACT_SCRIPT)}...`);
    execFileSync(process.execPath, [WIDGET_ARTIFACT_SCRIPT], {
        cwd: REPO_ROOT,
        stdio: 'inherit',
    });
}

async function uploadDirectory(localDirPath: string, bucketPrefix: string, s3Client: S3Client, logger: Logger): Promise<void> {
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

export async function deployWidgetsToR2(options: DeployWidgetsOptions = {}): Promise<void> {
    const logger = options.logger || console;
    const s3Client = options.s3Client || createR2Client();

    if (options.generateArtifacts !== false) {
        generateWidgetArtifacts(logger);
    }

    logger.log(`[widgets] Uploading ${path.relative(REPO_ROOT, WIDGETS_LOCAL_DIR)} to ${WIDGETS_BUCKET_PREFIX}...`);
    await uploadDirectory(WIDGETS_LOCAL_DIR, WIDGETS_BUCKET_PREFIX, s3Client, logger);
}

export {
    REPO_ROOT,
    WIDGETS_BUCKET_PREFIX,
    WIDGETS_LOCAL_DIR,
    WIDGET_ARTIFACT_SCRIPT,
};
