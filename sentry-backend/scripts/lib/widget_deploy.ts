import { S3Client } from '@aws-sdk/client-s3';
import { execFileSync } from 'child_process';
import path from 'path';
import { createR2Client, Logger, REPO_ROOT, uploadDirectory, WIDGETS_BUCKET_PREFIX } from './r2_artifacts';

interface DeployWidgetsOptions {
    s3Client?: S3Client;
    logger?: Logger;
    generateArtifacts?: boolean;
}

const WIDGETS_LOCAL_DIR = path.join(REPO_ROOT, 'r2-system', 'widgets');
const WIDGET_ARTIFACT_SCRIPT = path.join(WIDGETS_LOCAL_DIR, 'generate-artifacts.mjs');

export function generateWidgetArtifacts(logger: Logger = console): void {
    logger.log(`[widgets] Generating widget artifacts with ${path.relative(REPO_ROOT, WIDGET_ARTIFACT_SCRIPT)}...`);
    execFileSync(process.execPath, [WIDGET_ARTIFACT_SCRIPT], {
        cwd: REPO_ROOT,
        stdio: 'inherit',
    });
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
