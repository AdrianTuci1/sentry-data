import { config } from '../src/config';
import { dynamoDbDocumentClient } from '../src/infrastructure/database/DynamoDBClient';
import { ProjectRepository } from '../src/infrastructure/repositories/ProjectRepository';
import { SourceRepository } from '../src/infrastructure/repositories/SourceRepository';
import { R2StorageService } from '../src/infrastructure/storage/R2StorageService';
import fs from 'fs';
import path from 'path';

type ScriptArgs = {
    tenantId: string;
    projectId?: string;
    dryRun: boolean;
    rewriteMockData: boolean;
};

type MockDatasetConfig = {
    localFile: string;
    contentType: string;
};

const MOCK_DATASETS: Record<string, MockDatasetConfig> = {
    'Olist Orders': { localFile: 'orders.parquet', contentType: 'application/octet-stream' },
    'Olist Products': { localFile: 'products.parquet', contentType: 'application/octet-stream' },
    'Olist Reviews': { localFile: 'reviews.parquet', contentType: 'application/octet-stream' },
};

const MOCK_PARQUETS_DIR = path.join(process.cwd(), 'scripts', 'datarobot', 'parquets');
const DERIVED_PROJECT_LAYERS = ['runtime', 'queries', 'projections', 'bronze', 'silver', 'gold', 'agents'];

function parseArgs(argv: string[]): ScriptArgs {
    const tenantId = argv.find((arg) => arg.startsWith('--tenantId='))?.split('=')[1];
    const projectId = argv.find((arg) => arg.startsWith('--projectId='))?.split('=')[1];
    const dryRun = argv.includes('--dry-run') || argv.includes('--dryRun');
    const rewriteMockData = argv.includes('--rewrite-mock-data') || argv.includes('--rewriteMockData');

    if (!tenantId) {
        console.error(
            'Usage: npx ts-node scripts/cleanup_runtime_findings.ts --tenantId=<tenant> [--projectId=<project>] [--dry-run] [--rewrite-mock-data]'
        );
        process.exit(1);
    }

    return { tenantId, projectId, dryRun, rewriteMockData };
}

function buildRuntimePrefix(tenantId: string, projectId: string): string {
    return `tenants/${tenantId}/projects/${projectId}/runtime/`;
}

function buildProjectLayerPrefix(tenantId: string, projectId: string, layer: string): string {
    return `tenants/${tenantId}/projects/${projectId}/${layer}/`;
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2));
    const projectRepo = new ProjectRepository(dynamoDbDocumentClient, config.aws.dynamoTable);
    const sourceRepo = new SourceRepository(dynamoDbDocumentClient, config.aws.dynamoTable);
    const r2Service = new R2StorageService();

    const projects = args.projectId
        ? [await projectRepo.findById(args.tenantId, args.projectId)].filter(Boolean)
        : await projectRepo.findAllForTenant(args.tenantId);

    if (projects.length === 0) {
        console.log(`[Cleanup] No projects found for tenant ${args.tenantId}.`);
        return;
    }

    console.log('══════════════════════════════════════════');
    console.log('  CLEANUP RUNTIME FINDINGS');
    console.log('══════════════════════════════════════════');
    console.log(`[Scope] Tenant: ${args.tenantId}`);
    console.log(`[Scope] Project filter: ${args.projectId || 'all tenant projects'}`);
    console.log(`[Mode] ${args.dryRun ? 'DRY RUN' : 'APPLY'}`);
    console.log('[Safety] This script preserves sources/, datasets, and system/r2-system.');
    console.log(`[Mock rewrite] ${args.rewriteMockData ? 'enabled' : 'disabled'}`);

    for (const project of projects) {
        if (!project) continue;

        const layerSummaries: Array<{ layer: string; prefix: string; count: number }> = [];
        for (const layer of DERIVED_PROJECT_LAYERS) {
            const prefix = buildProjectLayerPrefix(project.tenantId, project.projectId, layer);
            const keys = await r2Service.listAllUnder(prefix);
            layerSummaries.push({ layer, prefix, count: keys.length });
        }

        const runtimePrefix = buildRuntimePrefix(project.tenantId, project.projectId);
        const runtimeKeys = layerSummaries.find((entry) => entry.layer === 'runtime')?.count || 0;
        const sources = await sourceRepo.findAllForProject(project.tenantId, project.projectId);
        const mockSources = sources.filter((source) => Boolean(MOCK_DATASETS[source.name]));
        const hadDiscoveryMetadata = Boolean(project.discoveryMetadata);
        const hadQueryConfigs = Array.isArray(project.queryConfigs) && project.queryConfigs.length > 0;
        const queryConfigCount = Array.isArray(project.queryConfigs) ? project.queryConfigs.length : 0;
        const hadParrotRuntime = Boolean(project.parrotRuntime);

        console.log(`\n[Project] ${project.projectId} (${project.name})`);
        for (const summary of layerSummaries) {
            console.log(`[Project] ${summary.layer}: ${summary.count}`);
        }
        console.log(`[Project] sources: ${sources.length} preserved`);
        console.log(`[Project] discoveryMetadata: ${hadDiscoveryMetadata ? 'present' : 'empty'}`);
        console.log(`[Project] queryConfigs: ${hadQueryConfigs ? queryConfigCount : 0}`);
        console.log(`[Project] parrotRuntime: ${hadParrotRuntime ? 'present' : 'empty'}`);
        if (args.rewriteMockData) {
            console.log(`[Project] mock sources to rewrite: ${mockSources.length}`);
        }

        if (args.dryRun) {
            for (const source of mockSources) {
                const mockConfig = MOCK_DATASETS[source.name];
                const localPath = path.join(MOCK_PARQUETS_DIR, mockConfig.localFile);
                console.log(`[Dry Run] Would rewrite ${source.name} from ${localPath}`);
            }
            continue;
        }

        for (const summary of layerSummaries) {
            if (summary.count === 0) {
                continue;
            }
            await r2Service.deleteObjects(summary.prefix);
        }

        const nextProject = { ...project };
        delete nextProject.discoveryMetadata;
        delete nextProject.parrotRuntime;
        nextProject.queryConfigs = [];

        await projectRepo.createOrUpdate({
            ...nextProject,
        });

        console.log('[OK] Cleared derived project artifacts and findings. Sources were preserved.');

        if (!args.rewriteMockData) {
            continue;
        }

        const currentDate = new Date().toISOString().split('T')[0];
        for (const source of mockSources) {
            const mockConfig = MOCK_DATASETS[source.name];
            const localPath = path.join(MOCK_PARQUETS_DIR, mockConfig.localFile);
            const sanitizedName = source.name.replace(/\s+/g, '_');
            const sourcePrefix = `tenants/${project.tenantId}/projects/${project.projectId}/sources/${sanitizedName}/`;

            if (!fs.existsSync(localPath)) {
                console.warn(`[WARN] Mock parquet missing for ${source.name}: ${localPath}`);
                continue;
            }

            await r2Service.deleteObjects(sourcePrefix);
            await r2Service.saveBuffer(
                project.tenantId,
                project.projectId,
                `sources/${sanitizedName}/${currentDate}`,
                fs.readFileSync(localPath),
                mockConfig.contentType,
                mockConfig.localFile
            );
            console.log(`[OK] Rewrote mock dataset for ${source.name}.`);
        }
    }

    console.log('\n[Done] Runtime findings cleanup finished.');
}

main().catch((error) => {
    console.error('[FATAL] cleanup_runtime_findings failed:', error);
    process.exit(1);
});
