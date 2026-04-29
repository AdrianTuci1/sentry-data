import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') });

async function uploadDist() {
    const config = {
        endpoint: process.env.R2_ENDPOINT,
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        bucket: process.env.R2_BUCKET_DATA,
        region: 'auto'
    };

    if (!config.endpoint || !config.accessKeyId || !config.secretAccessKey) {
        console.error('Missing R2 credentials in .env');
        process.exit(1);
    }

    const s3Client = new S3Client({
        region: config.region,
        endpoint: config.endpoint,
        credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
        },
    });

    const pnePackagePath = path.join(process.cwd(), '..', 'packages', 'pne-bridge', 'package.json');
    const pnePackage = JSON.parse(fs.readFileSync(pnePackagePath, 'utf8'));
    const version = pnePackage.version;

    const tarballName = `statsparrot-pne-${version}.tgz`;
    const tarballPath = path.join(process.cwd(), '..', 'packages', 'pne-bridge', tarballName);
    const installScriptPath = path.join(process.cwd(), '..', 'packages', 'pne-bridge', 'install.sh');

    if (!fs.existsSync(tarballPath)) {
        console.error(`Tarball not found: ${tarballPath}. Did you run 'npm pack' in packages/pne-bridge?`);
        process.exit(1);
    }

    const filesToUpload = [
        { 
            local: tarballPath, 
            key: `dist/pne/${tarballName}`, 
            contentType: 'application/gzip' 
        },
        { 
            local: tarballPath, 
            key: 'dist/pne/statsparrot-pne-latest.tgz', // Optional: keep a 'latest' alias in R2
            contentType: 'application/gzip' 
        },
        { 
            local: installScriptPath, 
            key: 'dist/pne/install.sh', 
            contentType: 'text/x-shellscript' 
        }
    ];

    for (const file of filesToUpload) {
        console.log(`[R2] Uploading ${path.basename(file.local)} to ${file.key}...`);
        
        try {
            const fileBuffer = fs.readFileSync(file.local);
            await s3Client.send(new PutObjectCommand({
                Bucket: config.bucket,
                Key: file.key,
                Body: fileBuffer,
                ContentType: file.contentType
            }));
            console.log(`[R2] ✅ Upload complete: ${file.key}`);
        } catch (error) {
            console.error(`[R2] ❌ Failed to upload ${file.key}:`, error);
        }
    }
}

uploadDist();
