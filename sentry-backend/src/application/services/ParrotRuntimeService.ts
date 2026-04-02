import { ProjectEntity, ProjectRepository } from '../../infrastructure/repositories/ProjectRepository';
import { SSEManager } from '../../services/sse/SSEManager';
import { RuntimeContext, RuntimeVitals } from '../../types/runtime';
import { ParrotNeuralEngineService } from './ParrotNeuralEngineService';
import { ParrotProgressService } from './ParrotProgressService';
import { ReverseEtlHeadService } from './ReverseEtlHeadService';
import { SentinelClient } from './SentinelClient';
import {
    ParrotBootstrapResult,
    ParrotProgressFile,
    ParrotRuntimeMetadata,
    ParrotSentinelReport
} from '../../types/parrot';

export class ParrotRuntimeService {
    constructor(
        private readonly parrotNeuralEngine: ParrotNeuralEngineService,
        private readonly parrotProgressService: ParrotProgressService,
        private readonly reverseEtlHeadService: ReverseEtlHeadService,
        private readonly sentinelClient: SentinelClient,
        private readonly projectRepo: ProjectRepository,
        private readonly sseManager: SSEManager
    ) {}

    public async bootstrapRun(project: ProjectEntity, ctx: RuntimeContext): Promise<ParrotBootstrapResult> {
        const requestId = this.buildRequestId();
        const reverseEtl = this.reverseEtlHeadService.buildPlan(project.parrotRuntime?.reverseEtl);
        const executionScore = await this.parrotNeuralEngine.buildExecutionScore(ctx, requestId, reverseEtl);
        const artifacts = this.parrotProgressService.buildArtifactUris(ctx.tenantId, ctx.projectId, requestId);

        let progressFile = this.parrotProgressService.createInitialProgressFile(
            requestId,
            executionScore.metadata.source_fingerprint,
            executionScore.metadata.translator_version,
            artifacts,
            reverseEtl
        );

        await this.parrotProgressService.saveExecutionScore(ctx.tenantId, ctx.projectId, requestId, executionScore);
        await this.parrotProgressService.saveProgressFile(ctx.tenantId, ctx.projectId, requestId, progressFile);

        this.sseManager.broadcastToTenant(ctx.tenantId, 'runtime_progress', {
            step: 'Parrot OS Planning',
            progress: 10,
            status: 'completed',
            requestId
        });

        const alignment = await this.sentinelClient.alignExecutionScore(ctx.tenantId, ctx.projectId, executionScore);
        const alignedExecutionScore = alignment.executionScore || executionScore;
        const sentinelReport: ParrotSentinelReport = {
            status: alignment.status,
            aligned: alignment.aligned,
            shouldReplan: alignment.shouldReplan,
            reasons: alignment.reasons,
            executionScoreVersion: alignedExecutionScore.metadata?.translator_version || executionScore.metadata.translator_version,
            checkedAt: new Date().toISOString(),
            details: alignment.details
        };

        await this.parrotProgressService.saveExecutionScore(ctx.tenantId, ctx.projectId, requestId, alignedExecutionScore);
        await this.parrotProgressService.saveSentinelReport(ctx.tenantId, ctx.projectId, requestId, sentinelReport);

        progressFile = this.parrotProgressService.markProgress(
            progressFile,
            'aligned',
            'sentinel_alignment',
            alignment.reasons.length > 0 ? { warnings: alignment.reasons } : undefined
        );
        await this.parrotProgressService.saveProgressFile(ctx.tenantId, ctx.projectId, requestId, progressFile);

        await this.updateProjectRuntime(ctx.tenantId, ctx.projectId, {
            mode: 'parrot_os',
            lastRequestId: requestId,
            status: progressFile.status,
            executionScoreUri: artifacts.executionScoreUri,
            progressFileUri: artifacts.progressFileUri,
            sentinelReportUri: artifacts.sentinelReportUri,
            outputManifestUri: artifacts.outputManifestUri,
            reverseEtlReceiptsUri: artifacts.reverseEtlReceiptsUri,
            executionPlanUri: artifacts.executionPlanUri,
            executionSubmissionUri: artifacts.executionSubmissionUri,
            sourceFingerprint: alignedExecutionScore.metadata.source_fingerprint,
            translatorVersion: alignedExecutionScore.metadata.translator_version,
            updatedAt: new Date().toISOString(),
            reverseEtl
        });

        this.sseManager.broadcastToTenant(ctx.tenantId, 'runtime_progress', {
            step: 'Sentinel Alignment',
            progress: 25,
            status: 'completed',
            requestId,
            reasons: alignment.reasons
        });

        return {
            requestId,
            executionScore: alignedExecutionScore,
            progressFile,
            sentinelReport,
            artifacts,
            reverseEtl
        };
    }

    public async markExecutionStarted(tenantId: string, projectId: string, bootstrap: ParrotBootstrapResult): Promise<ParrotProgressFile> {
        const progressFile = this.parrotProgressService.markProgress(bootstrap.progressFile, 'executing', 'execution_submission');
        bootstrap.progressFile = progressFile;
        await this.parrotProgressService.saveProgressFile(tenantId, projectId, bootstrap.requestId, progressFile);
        await this.updateProjectRuntime(tenantId, projectId, {
            mode: 'parrot_os',
            lastRequestId: bootstrap.requestId,
            status: progressFile.status,
            updatedAt: new Date().toISOString(),
            reverseEtl: bootstrap.reverseEtl
        });

        this.sseManager.broadcastToTenant(tenantId, 'runtime_progress', {
            step: 'Parrot OS Execution',
            progress: 40,
            status: 'in_progress',
            requestId: bootstrap.requestId
        });

        return progressFile;
    }

    public async completeRun(
        tenantId: string,
        projectId: string,
        bootstrap: ParrotBootstrapResult,
        discovery: any,
        vitals?: RuntimeVitals
    ): Promise<ParrotProgressFile> {
        const outputManifest = this.reverseEtlHeadService.buildOutputManifest(bootstrap.requestId, discovery, bootstrap.reverseEtl);
        const receipts = this.reverseEtlHeadService.buildReceipts(bootstrap.reverseEtl);

        await this.parrotProgressService.saveOutputManifest(tenantId, projectId, bootstrap.requestId, outputManifest);
        await this.parrotProgressService.saveReverseEtlReceipts(tenantId, projectId, bootstrap.requestId, receipts);

        const warnings = [
            ...(bootstrap.progressFile.warnings || []),
            ...(bootstrap.reverseEtl.dnsTxtVerification.verified ? [] : ['reverse_etl_dns_txt_verification_pending'])
        ];

        const progressFile = this.parrotProgressService.markProgress(
            bootstrap.progressFile,
            'completed',
            'outputs_ready',
            warnings.length > 0 ? { warnings } : undefined
        );
        bootstrap.progressFile = progressFile;
        await this.parrotProgressService.saveProgressFile(tenantId, projectId, bootstrap.requestId, progressFile);

        await this.updateProjectRuntime(tenantId, projectId, {
            mode: 'parrot_os',
            lastRequestId: bootstrap.requestId,
            status: progressFile.status,
            executionScoreUri: bootstrap.artifacts.executionScoreUri,
            progressFileUri: bootstrap.artifacts.progressFileUri,
            sentinelReportUri: bootstrap.artifacts.sentinelReportUri,
            outputManifestUri: bootstrap.artifacts.outputManifestUri,
            reverseEtlReceiptsUri: bootstrap.artifacts.reverseEtlReceiptsUri,
            executionPlanUri: bootstrap.artifacts.executionPlanUri,
            executionSubmissionUri: bootstrap.artifacts.executionSubmissionUri,
            sourceFingerprint: bootstrap.executionScore.metadata.source_fingerprint,
            translatorVersion: bootstrap.executionScore.metadata.translator_version,
            updatedAt: new Date().toISOString(),
            reverseEtl: bootstrap.reverseEtl
        });

        this.sseManager.broadcastToTenant(tenantId, 'runtime_progress', {
            step: 'Parrot OS Outputs Ready',
            progress: 100,
            status: 'completed',
            requestId: bootstrap.requestId,
            pathUsed: vitals?.pathUsed || 'parrot_os'
        });

        return progressFile;
    }

    public async failRun(
        tenantId: string,
        projectId: string,
        bootstrap: ParrotBootstrapResult | null,
        error: Error
    ): Promise<void> {
        const requestId = bootstrap?.requestId;
        if (bootstrap && requestId) {
            const progressFile = this.parrotProgressService.markProgress(bootstrap.progressFile, 'error', 'failed', {
                errors: [error.message]
            });
            bootstrap.progressFile = progressFile;
            await this.parrotProgressService.saveProgressFile(tenantId, projectId, requestId, progressFile);
        }

        await this.updateProjectRuntime(tenantId, projectId, {
            mode: 'parrot_os',
            lastRequestId: requestId,
            status: 'error',
            updatedAt: new Date().toISOString()
        });
    }

    private async updateProjectRuntime(tenantId: string, projectId: string, patch: ParrotRuntimeMetadata): Promise<void> {
        const latestProject = await this.projectRepo.findById(tenantId, projectId);
        if (!latestProject) return;

        latestProject.runtimeMode = 'parrot_os';
        latestProject.parrotRuntime = {
            ...(latestProject.parrotRuntime || { mode: 'parrot_os' }),
            ...patch
        };

        await this.projectRepo.createOrUpdate(latestProject);
    }

    private buildRequestId(): string {
        const suffix = Math.random().toString(36).slice(2, 10);
        return `parrot-${Date.now()}-${suffix}`;
    }
}
