import { ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDbDocumentClient } from '../infrastructure/database/DynamoDBClient';
import { TenantRepository } from '../infrastructure/repositories/TenantRepository';
import { ProjectRepository } from '../infrastructure/repositories/ProjectRepository';
import { SourceRepository } from '../infrastructure/repositories/SourceRepository';
import { R2StorageService } from '../infrastructure/storage/R2StorageService';
import { config } from '../config';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
// widget_deploy and S3Client removed as PNE handles widgets internally

async function run() {
    console.log('══════════════════════════════════════════');
    console.log('  SYSTEM FULL RESET: NUCLEAR OPTION');
    console.log('══════════════════════════════════════════\n');

    const args = process.argv.slice(2);
    const userEmail = args.find(a => a.startsWith('--email='))?.split('=')[1] || 'adrian.tucicovenco@gmail.com';
    const userName = args.find(a => a.startsWith('--name='))?.split('=')[1] || 'Adrian Tuci';

    const r2Service = new R2StorageService();
    const tenantRepo = new TenantRepository(dynamoDbDocumentClient, config.aws.dynamoTable);
    const projectRepo = new ProjectRepository(dynamoDbDocumentClient, config.aws.dynamoTable);
    const sourceRepo = new SourceRepository(dynamoDbDocumentClient, config.aws.dynamoTable);

    try {
        // ── STEP 1: CLEANUP DYNAMODB (Tenants & Projects only) ────────
        console.log(`[DB] Cleaning tenant data from table: ${config.aws.dynamoTable}...`);
        let lastEvaluatedKey: any;
        let deletedDbItems = 0;
        do {
            const scanResult = await dynamoDbDocumentClient.send(new ScanCommand({
                TableName: config.aws.dynamoTable,
                ExclusiveStartKey: lastEvaluatedKey
            }));
            const items = scanResult.Items || [];
            for (const item of items) {
                const pk = item.PK || '';
                // Only delete items related to tenants or projects
                if (typeof pk === 'string' && (pk.startsWith('TENANT#') || pk.startsWith('PROJECT#'))) {
                    await dynamoDbDocumentClient.send(new DeleteCommand({
                        TableName: config.aws.dynamoTable,
                        Key: { PK: item.PK, SK: item.SK }
                    }));
                    deletedDbItems += 1;
                }
            }
            lastEvaluatedKey = scanResult.LastEvaluatedKey;
        } while (lastEvaluatedKey);
        console.log(`[DB] Deleted ${deletedDbItems} tenant-related item(s).`);

        // ── STEP 2: CLEANUP R2 (Tenants folder only) ──────────
        console.log(`[R2] Wiping only tenants/ prefix...`);
        await r2Service.deleteObjects('tenants/');

        // ── STEP 3: SEED TEST DATA ───────────────────────────
        const tenantId = 'test_tenant_1';
        const projectId = 'proj_ecommerce_demo';

        console.log(`[DB] Creating Test Tenant: ${tenantId}...`);
        await tenantRepo.createTenant({
            id: tenantId,
            name: 'V8 Media Global',
            email: userEmail,
            subscriptionPlan: 'pro',
            status: 'active'
        });

        console.log(`[DB] Creating Demo Project: ${projectId}...`);
        await projectRepo.createOrUpdate({
            tenantId,
            projectId,
            name: 'E-Commerce Analytics Pulse',
            sourceType: 'custom',
            status: 'active',
            createdAt: new Date().toISOString()
        });

        // Seed Datasets
        const DATASETS = [
            { name: 'Olist Orders', file: 'orders.parquet' },
            { name: 'Olist Products', file: 'products.parquet' },
            { name: 'Olist Reviews', file: 'reviews.parquet' }
        ];

        const datarobotDir = path.join(process.cwd(), 'scripts', 'datarobot', 'parquets');
        const currentDate = new Date().toISOString().split('T')[0];

        for (const dataset of DATASETS) {
            const localPath = path.join(datarobotDir, dataset.file);
            if (!fs.existsSync(localPath)) {
                console.warn(`[Seed] ⚠ File missing: ${localPath} - skipping.`);
                continue;
            }

            const sanitizedName = dataset.name.replace(/\s+/g, '_');
            const r2UriGlob = `s3://${config.r2.bucketData}/tenants/${tenantId}/projects/${projectId}/sources/${sanitizedName}/**/*.parquet`;

            console.log(`[R2] Seeding Dataset: ${dataset.name}...`);
            await r2Service.saveBuffer(
                tenantId,
                projectId,
                `sources/${sanitizedName}/${currentDate}`,
                fs.readFileSync(localPath),
                'application/octet-stream',
                dataset.file
            );

            await sourceRepo.createOrUpdate({
                tenantId,
                projectId,
                sourceId: uuidv4(),
                name: dataset.name,
                uri: r2UriGlob,
                type: 'parquet',
                createdAt: new Date().toISOString()
            });
        }

        // ── STEP 5: GENERATE TOKEN ───────────────────────────
        const token = jwt.sign(
            {
                tenantId,
                userId: 'user_adrian',
                email: userEmail,
                name: userName,
                role: 'owner',
                workspaceId: `ws_${tenantId}_main`
            },
            config.jwt.secret,
            { expiresIn: '7d' }
        );

        console.log('\n══════════════════════════════════════════');
        console.log('  RESET & SEED COMPLETE');
        console.log('══════════════════════════════════════════');
        console.log(`\nAUTH TOKEN:\n  Bearer ${token}\n`);

    } catch (error) {
        console.error('\n[FATAL] Reset failed:', error);
        process.exit(1);
    }
}

run();
