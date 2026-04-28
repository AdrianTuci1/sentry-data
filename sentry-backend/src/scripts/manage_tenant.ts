import { dynamoDbDocumentClient } from '../infrastructure/database/DynamoDBClient';
import { TenantRepository } from '../infrastructure/repositories/TenantRepository';
import { R2StorageService } from '../infrastructure/storage/R2StorageService';
import { config } from '../config';
import fs from 'fs';
import path from 'path';

async function run() {
    const args = process.argv.slice(2);
    const action = args.find(a => a.startsWith('--action='))?.split('=')[1];
    const tenantId = args.find(a => a.startsWith('--tenantId='))?.split('=')[1];
    const projectId = args.find(a => a.startsWith('--projectId='))?.split('=')[1] || 'default-project';
    const sourceFile = args.find(a => a.startsWith('--sourceFile='))?.split('=')[1];
    
    const name = args.find(a => a.startsWith('--name='))?.split('=')[1] || 'Default Tenant';
    const email = args.find(a => a.startsWith('--email='))?.split('=')[1] || 'admin@tenant.com';

    if (!action || !tenantId) {
        console.error('Usage: npx ts-node src/scripts/manage_tenant.ts --action=setup|cleanup|seed --tenantId=xyz [--projectId=...] [--sourceFile=path/to/file]');
        process.exit(1);
    }

    const tenantRepo = new TenantRepository(dynamoDbDocumentClient, config.aws.dynamoTable);
    const r2Service = new R2StorageService();

    if (action === 'cleanup' || action === 'reset') {
        console.log(`[Cleanup] Wiping R2 data for tenant ${tenantId}...`);
        await r2Service.deleteObjects(`tenants/${tenantId}/`);

        console.log(`[Cleanup] Deleting DynamoDB profile...`);
        const { DeleteCommand } = await import('@aws-sdk/lib-dynamodb');
        await dynamoDbDocumentClient.send(new DeleteCommand({
            TableName: config.aws.dynamoTable,
            Key: {
                PK: `TENANT#${tenantId}`,
                SK: `PROFILE`
            }
        }));
        
        if (action === 'cleanup') {
            console.log(`[Success] Tenant ${tenantId} fully removed.`);
            return;
        }
    }

    if (action === 'setup' || action === 'reset' || action === 'seed') {
        if (action !== 'seed') {
            console.log(`[Setup] Creating/Updating tenant ${tenantId} profile...`);
            await tenantRepo.createTenant({
                id: tenantId,
                name,
                email,
                subscriptionPlan: 'pro',
                status: 'active'
            });
        }

        if (sourceFile) {
            if (!fs.existsSync(sourceFile)) {
                console.error(`[Error] Source file not found: ${sourceFile}`);
                process.exit(1);
            }

            const fileName = path.basename(sourceFile);
            const fileBuffer = fs.readFileSync(sourceFile);
            const contentType = fileName.endsWith('.parquet') ? 'application/octet-stream' : 'text/csv';

            console.log(`[Seed] Uploading ${fileName} to project ${projectId} raw storage...`);
            // Key structure: tenants/{tenantId}/{projectId}/raw/{fileName}
            await r2Service.saveBuffer(
                tenantId,
                projectId,
                'raw',
                fileBuffer,
                contentType,
                fileName
            );
            
            console.log(`[Success] Data seeded at: tenants/${tenantId}/${projectId}/raw/${fileName}`);
        } else if (action !== 'seed') {
            // Minimal init file if no source provided
            await r2Service.saveText(tenantId, projectId, 'raw', 'init', 'text/plain', 'init.txt');
        }

        console.log(`[Success] Tenant ${tenantId} ${action} complete.`);
    }
}

run().catch(err => {
    console.error('Error executing tenant management script:', err);
    process.exit(1);
});
