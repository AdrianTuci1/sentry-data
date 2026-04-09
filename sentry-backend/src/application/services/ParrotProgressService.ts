import { R2StorageService } from '../../infrastructure/storage/R2StorageService';
import {
    ParrotArtifactUris,
    ParrotExecutionScore,
    ParrotExecutionPlan,
    ParrotExecutionSubmission,
    ParrotProgressFile,
    ParrotSentinelReport,
    ParrotOutputManifest,
    ReverseEtlReceipt,
    ReverseEtlStreamPlan
} from '../../types/parrot';

export class ParrotProgressService {
    constructor(private readonly r2StorageService: R2StorageService) {}

    public buildArtifactUris(tenantId: string, projectId: string, requestId: string): ParrotArtifactUris {
        return {
            executionScoreUri: this.r2StorageService.getS3Uri(tenantId, projectId, 'runtime', 'requests', requestId, 'execution-score.json'),
            progressFileUri: this.r2StorageService.getS3Uri(tenantId, projectId, 'runtime', 'requests', requestId, 'progress.json'),
            sentinelReportUri: this.r2StorageService.getS3Uri(tenantId, projectId, 'runtime', 'requests', requestId, 'sentinel-report.json'),
            outputManifestUri: this.r2StorageService.getS3Uri(tenantId, projectId, 'runtime', 'requests', requestId, 'output-manifest.json'),
            reverseEtlReceiptsUri: this.r2StorageService.getS3Uri(tenantId, projectId, 'runtime', 'requests', requestId, 'reverse-etl-receipts.json'),
            executionPlanUri: this.r2StorageService.getS3Uri(tenantId, projectId, 'runtime', 'requests', requestId, 'execution-plan.json'),
            executionSubmissionUri: this.r2StorageService.getS3Uri(tenantId, projectId, 'runtime', 'requests', requestId, 'execution-submission.json'),
            mindmapManifestUri: this.r2StorageService.getS3Uri(tenantId, projectId, 'runtime', 'requests', requestId, 'mindmap-manifest.json')
        };
    }

    public createInitialProgressFile(
        requestId: string,
        sourceFingerprint: string,
        translatorVersion: string,
        artifacts: ParrotArtifactUris,
        reverseEtl: ReverseEtlStreamPlan
    ): ParrotProgressFile {
        return {
            request_id: requestId,
            source_fingerprint: sourceFingerprint,
            translator_version: translatorVersion,
            status: 'planning',
            last_completed_stage: 'execution_score',
            delta: {
                new_partitions: [new Date().toISOString().split('T')[0]],
                replayed_history: false
            },
            artifacts,
            reverse_etl: {
                status: reverseEtl.status,
                dns_txt_verification_required: reverseEtl.dnsTxtVerification.required,
                active_vm_count: reverseEtl.activeVmCount
            },
            updated_at: new Date().toISOString()
        };
    }

    public async saveExecutionScore(tenantId: string, projectId: string, requestId: string, executionScore: ParrotExecutionScore): Promise<void> {
        await this.r2StorageService.saveJson(tenantId, projectId, 'runtime', executionScore, 'requests', requestId, 'execution-score.json');
    }

    public async saveExecutionPlan(tenantId: string, projectId: string, requestId: string, executionPlan: ParrotExecutionPlan): Promise<void> {
        await this.r2StorageService.saveJson(tenantId, projectId, 'runtime', executionPlan, 'requests', requestId, 'execution-plan.json');
    }

    public async saveExecutionSubmission(tenantId: string, projectId: string, requestId: string, executionSubmission: ParrotExecutionSubmission): Promise<void> {
        await this.r2StorageService.saveJson(tenantId, projectId, 'runtime', executionSubmission, 'requests', requestId, 'execution-submission.json');
    }

    public async saveProgressFile(tenantId: string, projectId: string, requestId: string, progressFile: ParrotProgressFile): Promise<void> {
        await this.r2StorageService.saveJson(tenantId, projectId, 'runtime', progressFile, 'requests', requestId, 'progress.json');
    }

    public async saveSentinelReport(tenantId: string, projectId: string, requestId: string, report: ParrotSentinelReport): Promise<void> {
        await this.r2StorageService.saveJson(tenantId, projectId, 'runtime', report, 'requests', requestId, 'sentinel-report.json');
    }

    public async saveOutputManifest(tenantId: string, projectId: string, requestId: string, manifest: ParrotOutputManifest): Promise<void> {
        await this.r2StorageService.saveJson(tenantId, projectId, 'runtime', manifest, 'requests', requestId, 'output-manifest.json');
    }

    public async saveReverseEtlReceipts(tenantId: string, projectId: string, requestId: string, receipts: ReverseEtlReceipt[]): Promise<void> {
        await this.r2StorageService.saveJson(tenantId, projectId, 'runtime', receipts, 'requests', requestId, 'reverse-etl-receipts.json');
    }

    public async saveMindMapYaml(tenantId: string, projectId: string, requestId: string, yamlContent: string): Promise<{ uri: string }> {
        const result = await this.r2StorageService.saveText(
            tenantId,
            projectId,
            'runtime',
            yamlContent,
            'application/yaml',
            'requests',
            requestId,
            'mindmap.yaml'
        );

        return { uri: result.uri };
    }

    public async saveMindMapManifest(tenantId: string, projectId: string, requestId: string, manifest: unknown): Promise<{ uri: string }> {
        const result = await this.r2StorageService.saveJson(
            tenantId,
            projectId,
            'runtime',
            manifest,
            'requests',
            requestId,
            'mindmap-manifest.json'
        );

        return { uri: result.uri };
    }

    public markProgress(
        progressFile: ParrotProgressFile,
        status: ParrotProgressFile['status'],
        lastCompletedStage: string,
        extras?: Partial<Pick<ParrotProgressFile, 'warnings' | 'errors'>>
    ): ParrotProgressFile {
        return {
            ...progressFile,
            status,
            last_completed_stage: lastCompletedStage,
            warnings: extras?.warnings ?? progressFile.warnings,
            errors: extras?.errors ?? progressFile.errors,
            updated_at: new Date().toISOString()
        };
    }
}
