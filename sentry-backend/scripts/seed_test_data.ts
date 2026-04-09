import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { config } from '../src/config';
import { TenantRepository } from '../src/infrastructure/repositories/TenantRepository';
import { ProjectRepository } from '../src/infrastructure/repositories/ProjectRepository';
import { SourceRepository } from '../src/infrastructure/repositories/SourceRepository';
import { v4 as uuidv4 } from 'uuid';
import { deployWidgetsToR2 } from './lib/widget_deploy';

// ═══════════════════════════════════════════════════════════
// DATASET CONFIGURATION — Edit this array to change what gets seeded
// ═══════════════════════════════════════════════════════════

interface DatasetConfig {
    /** Human-readable name for the source connector */
    name: string;
    /** Local filename relative to scripts/datarobot/ */
    localFile: string;
    /** Source type tag */
    type: string;
    /** Optional cron schedule for automated refresh */
    cronSchedule?: string;
}

const DATASETS: DatasetConfig[] = [
    {
        name: 'Olist Orders',
        localFile: 'orders.parquet',
        type: 'parquet',
        cronSchedule: '0 2 * * *',
    },
    // {
    //     name: 'Olist Order Items',
    //     localFile: 'order_items.parquet',
    //     type: 'parquet',
    //     cronSchedule: '0 2 * * *',
    // },
    {
        name: 'Olist Products',
        localFile: 'products.parquet',
        type: 'parquet',
        cronSchedule: '0 2 * * *',
    },
    {
        name: 'Olist Reviews',
        localFile: 'reviews.parquet',
        type: 'parquet',
        cronSchedule: '0 2 * * *',
    }
];

// ═══════════════════════════════════════════════════════════
// SEED SCRIPT
// ═══════════════════════════════════════════════════════════

async function seed() {
    console.log('══════════════════════════════════════════');
    console.log('  SEEDING SYSTEM & TEST DATA');
    console.log('══════════════════════════════════════════\n');

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

    const docClient = DynamoDBDocumentClient.from(ddbClient);
    const tenantRepo = new TenantRepository(docClient, config.aws.dynamoTable);
    const projectRepo = new ProjectRepository(docClient, config.aws.dynamoTable);
    const sourceRepo = new SourceRepository(docClient, config.aws.dynamoTable);

    const tenantId = 'test_tenant_1';
    const projectId = 'proj_ecommerce_demo';

    try {
        // ── STEP 1: SEED TENANT & PROJECT ────────────────────

        console.log(`[DB] Creating Tenant: ${tenantId}...`);
        await tenantRepo.createTenant({
            id: tenantId,
            name: 'Test Business Corp',
            email: 'adriantuci@example.com',
            subscriptionPlan: 'pro',
            status: 'active'
        });

        console.log(`[DB] Creating Project: ${projectId}...`);
        await projectRepo.createOrUpdate({
            tenantId,
            projectId,
            name: 'E-Commerce Analytics Demo',
            sourceType: 'custom',
            status: 'active',
            createdAt: new Date().toISOString()
        });

        // ── STEP 2: UPLOAD DISCOVERY WIDGETS ────────────────

        console.log('\n[R2] Uploading discovery widgets...');
        await deployWidgetsToR2({ s3Client });

        // ── STEP 3: UPLOAD DATASETS & CREATE SOURCE CONNECTORS ──

        console.log(`\n[DATA] Processing ${DATASETS.length} dataset(s)...`);
        const datarobotDir = path.join(__dirname, 'datarobot', 'parquets');
        const sourceUris: string[] = [];

        for (const dataset of DATASETS) {
            const localPath = path.join(datarobotDir, dataset.localFile);

            if (!fs.existsSync(localPath)) {
                console.warn(`[DATA] ⚠  File not found: ${localPath} — skipping "${dataset.name}"`);
                console.warn(`       Run: cd scripts/datarobot && python generate_parquets.py`);
                // ### Automated Tests
                // 1. **Pipeline Execution**: Run `npm run pipeline` and verify (via logs) that `data_normalizer` and `feature_engineer` correctly read data from the new partitioned paths.
                // 2. **Double Seed Test**: Add a second file for one connector in a different date folder and verify the pipeline aggregates both correctly.
                continue;
            }

            // Upload parquet to the zero-ETL source object prefix
            const sanitizedName = dataset.name.replace(/\s+/g, '_');
            const currentDate = new Date().toISOString().split('T')[0];
            const r2Key = `tenants/${tenantId}/projects/${projectId}/sources/${sanitizedName}/${currentDate}/${dataset.localFile}`;
            const r2UriExact = `s3://${config.r2.bucketData}/${r2Key}`;

            // The runtime should read all partitions for a connector.
            const r2UriGlob = `s3://${config.r2.bucketData}/tenants/${tenantId}/projects/${projectId}/sources/${sanitizedName}/**/*.parquet`;

            console.log(`[R2] Uploading: ${dataset.name} → ${r2Key}`);
            await s3Client.send(new PutObjectCommand({
                Bucket: config.r2.bucketData,
                Key: r2Key,
                Body: fs.readFileSync(localPath),
                ContentType: 'application/octet-stream',
            }));

            // Create Source connector in DynamoDB using the GLOB path
            const sourceId = uuidv4();
            await sourceRepo.createOrUpdate({
                tenantId,
                projectId,
                sourceId,
                name: dataset.name,
                uri: r2UriGlob,
                type: dataset.type,
                cronSchedule: dataset.cronSchedule,
                createdAt: new Date().toISOString(),
            });

            console.log(`[DB] Source connector created: "${dataset.name}" (${sourceId}) | URI: ${r2UriGlob}`);
            if (dataset.cronSchedule) {
                console.log(`     Cron: ${dataset.cronSchedule}`);
            }

            sourceUris.push(r2UriGlob);
        }

        console.log(`\n[DATA] ${sourceUris.length}/${DATASETS.length} dataset(s) uploaded & connected.`);

        // ── STEP 4: GENERATE AUTH TOKEN ──────────────────────

        const token = jwt.sign(
            {
                tenantId,
                userId: 'user_adrian',
                email: 'adrian.tucicovenco@gmail.com',
                name: 'Adrian Tuci',
                role: 'owner',
                workspaceId: `ws_${tenantId}_main`
            },
            config.jwt.secret,
            { expiresIn: '24h' }
        );

        console.log('\n══════════════════════════════════════════');
        console.log('  SEEDING COMPLETE');
        console.log('══════════════════════════════════════════');
        console.log(`\nTenant:    ${tenantId}`);
        console.log(`Project:   ${projectId}`);
        console.log(`Sources:   ${sourceUris.length}`);
        console.log(`\nAUTH TOKEN:\n  Bearer ${token}\n`);
        console.log('Pipeline run (no body needed):');
        console.log(`  POST /api/projects/${projectId}/runtime/run\n`);

    } catch (error) {
        console.error('Seed failed:', error);
        process.exit(1);
    }
}

seed();
