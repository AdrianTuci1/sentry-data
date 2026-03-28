import { BasePipelineStep } from './PipelineStep';
import { PipelineContext, PipelineResult } from '../types';
import { ProjectRepository } from '../../../infrastructure/repositories/ProjectRepository';
import { SchemaFingerprint, SourceSchema } from '../SchemaFingerprint';

export class ChangeDetectionStep extends BasePipelineStep {
    constructor(private projectRepo: ProjectRepository) {
        super();
    }

    getName(): string {
        return 'ChangeDetection';
    }

    async execute(ctx: PipelineContext, result: Partial<PipelineResult>): Promise<void> {
        this.log('Detecting schema changes...');
        const { tenantId, projectId, rawSourceUris, sourceNames } = ctx;

        const effectiveSourceNames = rawSourceUris.map((_, i) => (sourceNames?.[i] || `source_${i}`).replace(/\s+/g, '_'));

        // Placeholder for real schema sampling
        const currentSchemas: SourceSchema[] = [];
        const project = await this.projectRepo.findById(tenantId, projectId);

        const currentFingerprint = SchemaFingerprint.compute(currentSchemas);
        let consolidatedInvalidations: string[] = ctx.invalidatedSources || [];

        if (project?.schemaFingerprint) {
            const invalidatedSources = SchemaFingerprint.getInvalidatedSources(project.schemaFingerprint, currentFingerprint);
            consolidatedInvalidations.push(...invalidatedSources);
        }

        ctx.invalidatedSources = [...new Set(consolidatedInvalidations)];
        
        // Initialize cumulative discovery if not present
        if (!ctx.discovery) {
            ctx.discovery = project?.discoveryMetadata || this.getDefaultDiscovery();
            this.ensureDiscoveryKeys(ctx.discovery);
            this.migrateLegacyKeys(ctx.discovery);
        }
    }

    private getDefaultDiscovery() {
        return {
            connector: [], actionType: [], adjustedData: [], group: [], insight: [],
            tables: [], metricGroups: [], sourceClassifications: [], predictionModels: []
        };
    }

    private ensureDiscoveryKeys(discovery: any) {
        const keys = ['connector', 'actionType', 'adjustedData', 'group', 'insight', 'tables', 'metricGroups', 'sourceClassifications', 'predictionModels'];
        for (const key of keys) {
            discovery[key] = discovery[key] || [];
        }
    }

    private migrateLegacyKeys(discovery: any) {
        if (discovery.dashboardGroups && !discovery.group?.length) {
            discovery.group = discovery.dashboardGroups;
        }
        if (discovery.dashboards && !discovery.insight?.length) {
            discovery.insight = discovery.dashboards;
        }
        delete discovery.dashboardGroups;
        delete discovery.dashboards;
    }
}
