import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import { config } from '../src/config';

async function syncWidgets() {
    console.log('══════════════════════════════════════════');
    console.log('  SYNCING WIDGET BOILERPLATES TO R2');
    console.log('══════════════════════════════════════════\n');

    const s3Client = new S3Client({
        region: 'auto',
        endpoint: config.r2.endpoint.replace(/\/$/, ""),
        credentials: {
            accessKeyId: config.r2.accessKeyId,
            secretAccessKey: config.r2.secretAccessKey,
        },
    });

    const boilerplatesPath = path.resolve(__dirname, '../../boilerplates');
    const bucketPrefix = 'system/boilerplates';

    const uploadDirectory = async (localDirPath: string, bucketPrefix: string) => {
        if (!fs.existsSync(localDirPath)) {
            console.error(`Directory not found: ${localDirPath}`);
            return;
        }

        const items = fs.readdirSync(localDirPath, { withFileTypes: true });
        for (const item of items) {
            const fullLocalPath = path.join(localDirPath, item.name);
            const bucketKey = `${bucketPrefix}/${item.name}`;

            if (item.isDirectory()) {
                await uploadDirectory(fullLocalPath, bucketKey);
            } else if (item.isFile()) {
                await s3Client.send(new PutObjectCommand({
                    Bucket: config.r2.bucketData,
                    Key: bucketKey,
                    Body: fs.readFileSync(fullLocalPath)
                }));
                console.log(`[R2] Uploaded: ${bucketKey}`);
            }
        }
    };

    try {
        await uploadDirectory(boilerplatesPath, bucketPrefix);
        console.log('\n[SUCCESS] All widgets synced to R2.');
    } catch (error) {
        console.error('Sync failed:', error);
        process.exit(1);
    }
}

syncWidgets();
