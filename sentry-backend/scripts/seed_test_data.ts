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
    console.log('--- SEEDING TEST DATA & R2 ASSETS ---');

    // Check credentials
    if (!config.aws.accessKeyId || !config.aws.secretAccessKey) {
        console.error('Error: AWS credentials missing in .env');
        process.exit(1);
    }

    const ddbClient = new DynamoDBClient({
        region: config.aws.region,
        credentials: {
            accessKeyId: config.aws.accessKeyId,
            secretAccessKey: config.aws.secretAccessKey
        }
    });

    const s3Client = new S3Client({
        region: 'auto',
        endpoint: config.r2.endpoint.replace(/\/$/, ""), // Ensure no trailing slash
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
        // 1. Create Tenant
        console.log(`[DB] Creating Tenant: ${tenantId}...`);
        await tenantRepo.createTenant({
            id: tenantId,
            name: 'Test Business Corp',
            email: 'adriantuci@example.com',
            subscriptionPlan: 'pro',
            status: 'active'
        });

        // 2. Generate JWT Token
        console.log('[Auth] Generating JWT Token...');
        const token = jwt.sign(
            { tenantId, role: 'admin' },
            config.jwt.secret,
            { expiresIn: '24h' }
        );

        // 3. Create Project
        console.log(`[DB] Creating Project: ${projectId} for Tenant: ${tenantId}...`);
        await projectRepo.createOrUpdate({
            tenantId,
            projectId,
            name: 'GA4 Demo Project',
            sourceType: 'custom',
            status: 'active',
            createdAt: new Date().toISOString()
        });

        // 4. Upload Boilerplates and Prompts to R2
        console.log('[R2] Uploading Boilerplates and Prompts...');
        const boilerplateDirs = [
            path.join(__dirname, '../../boilerplates'),
            path.join(__dirname, '../../boilerplates/tasks'),
            path.join(__dirname, '../../boilerplates/prompts')
        ];

        for (const dir of boilerplateDirs) {
            if (fs.existsSync(dir)) {
                const files = fs.readdirSync(dir);
                for (const file of files) {
                    if (file.endsWith('.py') || file.endsWith('.txt')) {
                        const filePath = path.join(dir, file);
                        const content = fs.readFileSync(filePath);

                        // Determine if the file is in a subdirectory (e.g., 'tasks', 'prompts')
                        const baseDir = path.join(__dirname, '../../boilerplates');
                        const relativePath = path.relative(baseDir, filePath);
                        const key = `system/boilerplates/${relativePath}`;

                        await s3Client.send(new PutObjectCommand({
                            Bucket: config.r2.bucketData,
                            Key: key,
                            Body: content
                        }));
                        console.log(`    Uploaded: ${key}`);
                    }
                }
            }
        }

        // 5. Upload Manifests
        const configDir = path.join(__dirname, '../../boilerplates/config');
        if (fs.existsSync(configDir)) {
            console.log('[R2] Uploading Manifests...');
            const configFiles = fs.readdirSync(configDir);
            for (const file of configFiles) {
                if (file.endsWith('.yml') || file.endsWith('.json')) {
                    const filePath = path.join(configDir, file);
                    await s3Client.send(new PutObjectCommand({
                        Bucket: config.r2.bucketData,
                        Key: `system/config/${file}`,
                        Body: fs.readFileSync(filePath)
                    }));
                    console.log(`    Uploaded Manifest: system/config/${file}`);
                }
            }
        }

        // Upload Mock Data
        const mockParquetKey = `tenants/${tenantId}/projects/${projectId}/bronze/ga4_export.parquet`;
        const mockDataPath = path.join(__dirname, '../scripts/ga4_test_data.parquet');
        if (fs.existsSync(mockDataPath)) {
            console.log(`[R2] Uploading Mock GA4 Data from ${mockDataPath}...`);
            await s3Client.send(new PutObjectCommand({
                Bucket: config.r2.bucketData,
                Key: mockParquetKey,
                Body: fs.readFileSync(mockDataPath),
            }));
        } else {
            console.warn('Mock data file not found:', mockDataPath);
            console.log('[R2] Uploading DUMMY Mock GA4 Data...');
            await s3Client.send(new PutObjectCommand({
                Bucket: config.r2.bucketData,
                Key: mockParquetKey,
                Body: Buffer.from("DUMMY PARQUET CONTENT - In a real test, upload a valid parquet file here")
            }));
        }

        console.log('\n--- SEEDING COMPLETE ---');
        console.log(`\nTENANT_ID: ${tenantId}`);
        console.log(`PROJECT_ID: ${projectId}`);
        console.log(`MOCK_DATA_PATH: s3://${config.r2.bucketData}/${mockParquetKey}`);
        console.log(`\n>>> AUTH TOKEN:`);
        console.log(`\nBearer ${token}\n`);
        console.log('------------------------');

    } catch (error) {
        console.error('Seed failed:', error);
        process.exit(1);
    }
}

seed();
