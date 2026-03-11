import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { config } from '../src/config';
import { TenantRepository } from '../src/infrastructure/repositories/TenantRepository';
import { ProjectRepository } from '../src/infrastructure/repositories/ProjectRepository';

async function seed() {
    console.log('--- SEEDING SYSTEM & TEST DATA ---');

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

    const tenantId = 'test_tenant_1';
    const projectId = 'proj_ga4_demo';

    try {
        // --- 1. SEED DYNAMODB ---
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
            name: 'GA4 Demo Project',
            sourceType: 'custom',
            status: 'active',
            createdAt: new Date().toISOString()
        });

        // --- 2. UPLOAD SYSTEM ASSETS (Specific prefixing for Orchestrator) ---
        const boilerplatesPath = path.join(__dirname, '../../boilerplates');

        const uploadSubDir = async (subDir: string, bucketPrefix: string, extensions: string[]) => {
            const dirPath = path.join(boilerplatesPath, subDir);
            if (!fs.existsSync(dirPath)) return;

            const files = fs.readdirSync(dirPath);
            for (const file of files) {
                if (extensions.some(ext => file.endsWith(ext))) {
                    const filePath = path.join(dirPath, file);
                    const key = `${bucketPrefix}/${file}`;
                    await s3Client.send(new PutObjectCommand({
                        Bucket: config.r2.bucketData,
                        Key: key,
                        Body: fs.readFileSync(filePath)
                    }));
                    console.log(`[R2] Uploaded: ${key}`);
                }
            }
        };

        console.log('[R2] Uploading System Boilerplates & Configs...');
        await uploadSubDir('tasks', 'system/boilerplates/tasks', ['.py']);
        await uploadSubDir('prompts', 'system/boilerplates/prompts', ['.txt']);
        await uploadSubDir('config', 'system/config', ['.yml', '.json']);

        // --- 3. UPLOAD MOCK DATA ---
        const mockParquetKey = `tenants/${tenantId}/projects/${projectId}/bronze/ga4_export.parquet`;
        const mockDataPath = path.join(__dirname, '../scripts/ga4_test_data.parquet');

        if (fs.existsSync(mockDataPath)) {
            console.log(`[R2] Uploading Mock GA4 Data: ${mockParquetKey}...`);
            await s3Client.send(new PutObjectCommand({
                Bucket: config.r2.bucketData,
                Key: mockParquetKey,
                Body: fs.readFileSync(mockDataPath),
            }));
        } else {
            console.warn(`[R2] Warning: Mock data file not found at ${mockDataPath}`);
        }

        // --- 4. GENERATE AUTH TOKEN ---
        const token = jwt.sign(
            { tenantId, role: 'admin' },
            config.jwt.secret,
            { expiresIn: '24h' }
        );

        console.log('\n--- SEEDING COMPLETE ---');
        console.log(`\nAUTH TOKEN: Bearer ${token}\n`);

    } catch (error) {
        console.error('Seed failed:', error);
        process.exit(1);
    }
}

seed();
