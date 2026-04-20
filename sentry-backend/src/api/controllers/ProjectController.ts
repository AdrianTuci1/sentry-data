import { NextFunction, Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { IController } from './IController';
import { OrchestrationService } from '../../application/services/OrchestrationService';
import { AnalyticsService } from '../../application/services/AnalyticsService';
import { requireAuth } from '../middlewares/auth';
import { AuthService } from '../../application/services/AuthService';
import { ProjectRepository } from '../../infrastructure/repositories/ProjectRepository';
import { SourceRepository } from '../../infrastructure/repositories/SourceRepository';
import { ObjectStorageConfig } from '../../types/storage';
import { ObjectStorageService } from '../../application/services/ObjectStorageService';
import { SourceUpdateMonitorService } from '../../application/services/SourceUpdateMonitorService';
import { ConnectorCatalogService } from '../../application/services/ConnectorCatalogService';
import { ControlPlaneService } from '../../application/services/ControlPlaneService';
import { MLExecutorClient, MLTrainRequest } from '../../application/services/MLExecutorClient';
import { SentinelFeedbackService } from '../../application/services/SentinelFeedbackService';
import { DecisionOverrideService } from '../../application/services/DecisionOverrideService';
import { AppError } from '../middlewares/errorHandler';
import { ProjectMemberInput } from '../../types/controlPlane';
import {
    ParrotDecisionOverride,
    ParrotMLRecommendation,
    ParrotSentinelFeedbackEvent
} from '../../types/parrot';

export class ProjectController implements IController {
    public path = '/projects';
    public router = Router();

    constructor(
        private readonly orchestrationService: OrchestrationService,
        private readonly analyticsService: AnalyticsService,
        private readonly authService: AuthService,
        private readonly projectRepo: ProjectRepository,
        private readonly sourceRepo: SourceRepository,
        private readonly objectStorageService: ObjectStorageService,
        private readonly sourceUpdateMonitorService: SourceUpdateMonitorService,
        private readonly connectorCatalogService: ConnectorCatalogService,
        private readonly controlPlaneService: ControlPlaneService,
        private readonly mlExecutorClient: MLExecutorClient,
        private readonly sentinelFeedbackService: SentinelFeedbackService,
        private readonly decisionOverrideService: DecisionOverrideService
    ) {
        this.initRoutes();
    }

    public initRoutes() {
        const auth = requireAuth(this.authService);

        this.router.get('/', auth, this.getProjects);
        this.router.post('/', auth, this.createProject);
        this.router.patch('/:projectId', auth, this.updateProject);
        this.router.get('/connectors/catalog', auth, this.getConnectorCatalog);
        this.router.get('/:projectId/share-links', auth, this.getShareLinks);
        this.router.post('/:projectId/share-links', auth, this.createShareLink);

        this.router.post('/:projectId/sources', auth, this.addSource);
        this.router.get('/:projectId/sources', auth, this.getSources);
        this.router.post('/:projectId/sources/discover', auth, this.discoverSources);
        this.router.delete('/:projectId/sources/:sourceId', auth, this.deleteSource);

        this.router.get('/:projectId/ml/recommendations', auth, this.getMlRecommendations);
        this.router.post('/:projectId/ml/recommendations/:recommendationId/train', auth, this.trainMlRecommendation);
        this.router.get('/:projectId/runtime/code-formulas', auth, this.getCodeFormulas);
        this.router.get('/:projectId/runtime/overrides', auth, this.getDecisionOverrides);
        this.router.post('/:projectId/runtime/overrides', auth, this.createDecisionOverride);
        this.router.post('/:projectId/feedback/sentinel', auth, this.recordSentinelFeedback);

        this.router.get('/:projectId', auth, this.getProjectById);
        this.router.post('/:projectId/runtime/run', auth, this.runRuntime);
        this.router.post('/:projectId/runtime/check-updates', auth, this.checkRuntimeUpdates);

        this.router.get('/:projectId/lineage', auth, this.getLineage);
        this.router.get('/:projectId/analytics', auth, this.getAnalytics);
    }

    private getProjects = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const authContext = this.getAuthContext(req);
            const projects = await this.controlPlaneService.listWorkspaceProjects(authContext, this.getRequestedWorkspaceId(req));

            res.status(200).json({
                status: 'success',
                data: projects
            });
        } catch (error) {
            next(error);
        }
    };

    private getProjectById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const authContext = this.getAuthContext(req);
            const { projectId } = req.params;
            const { project, members } = await this.controlPlaneService.assertProjectAccess(authContext, projectId);

            res.status(200).json({
                status: 'success',
                data: {
                    ...project,
                    members: members.map((member) => ({
                        userId: member.userId,
                        account: member.account,
                        access: member.access
                    })),
                    viewLink: project.viewLink || this.buildDefaultViewLink(project.name, project.projectId)
                }
            });
        } catch (error) {
            next(error);
        }
    };

    private createProject = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const authContext = this.getAuthContext(req);
            const { name, members, viewLink, workspaceId } = req.body as {
                name?: string;
                members?: ProjectMemberInput[];
                viewLink?: string;
                workspaceId?: string;
            };

            if (!name?.trim()) {
                res.status(400).json({ error: 'Project name is required' });
                return;
            }

            const { workspace, membership } = await this.controlPlaneService.resolveWorkspace(
                authContext,
                workspaceId || this.getRequestedWorkspaceId(req)
            );

            if (!['owner', 'admin', 'member'].includes(membership.role)) {
                throw new AppError('Your workspace role cannot create projects.', 403);
            }

            const projectId = `proj_${Date.now()}`;
            const createdAt = new Date().toISOString();

            await this.projectRepo.createOrUpdate({
                tenantId: authContext.tenantId,
                projectId,
                workspaceId: workspace.workspaceId,
                name: name.trim(),
                sourceType: 'custom',
                status: 'active',
                createdAt,
                viewLink: viewLink?.trim() || this.buildDefaultViewLink(name, projectId)
            });

            const savedMembers = await this.controlPlaneService.syncProjectMembers(authContext, workspace.workspaceId, projectId, members);
            await this.controlPlaneService.recordProjectEvent(
                authContext,
                workspace.workspaceId,
                projectId,
                'project.created',
                `Created project ${name.trim()}`,
                { memberCount: savedMembers.length }
            );
            const project = await this.projectRepo.findById(authContext.tenantId, projectId);

            res.status(201).json({
                status: 'success',
                message: 'Project created',
                data: {
                    ...project,
                    members: savedMembers.map((member) => ({
                        userId: member.userId,
                        account: member.account,
                        access: member.access
                    }))
                }
            });
        } catch (error) {
            next(error);
        }
    };

    private updateProject = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const authContext = this.getAuthContext(req);
            const { projectId } = req.params;
            const { name, members, viewLink } = req.body as {
                name?: string;
                members?: ProjectMemberInput[];
                viewLink?: string;
            };

            const { project, workspace } = await this.controlPlaneService.assertProjectAccess(authContext, projectId);
            project.name = name?.trim() || project.name;
            project.viewLink = viewLink?.trim() || project.viewLink || this.buildDefaultViewLink(project.name, project.projectId);
            project.workspaceId = project.workspaceId || workspace.workspaceId;
            await this.projectRepo.createOrUpdate(project);

            const savedMembers = await this.controlPlaneService.syncProjectMembers(authContext, workspace.workspaceId, projectId, members);
            await this.controlPlaneService.recordProjectEvent(
                authContext,
                workspace.workspaceId,
                projectId,
                'project.updated',
                `Updated project ${project.name}`,
                { memberCount: savedMembers.length }
            );

            res.status(200).json({
                status: 'success',
                message: 'Project updated',
                data: {
                    ...project,
                    members: savedMembers.map((member) => ({
                        userId: member.userId,
                        account: member.account,
                        access: member.access
                    }))
                }
            });
        } catch (error) {
            next(error);
        }
    };

    private getConnectorCatalog = async (req: Request, res: Response, next: NextFunction) => {
        try {
            res.status(200).json({
                status: 'success',
                data: this.connectorCatalogService.listCatalog()
            });
        } catch (error) {
            next(error);
        }
    };

    private getShareLinks = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const authContext = this.getAuthContext(req);
            const { projectId } = req.params;
            const links = await this.controlPlaneService.listProjectShareLinks(authContext, projectId);

            res.status(200).json({
                status: 'success',
                data: links
            });
        } catch (error) {
            next(error);
        }
    };

    private createShareLink = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const authContext = this.getAuthContext(req);
            const { projectId } = req.params;
            const { label, expiresInDays } = req.body as { label?: string; expiresInDays?: number };
            const shareLink = await this.controlPlaneService.createProjectShareLink(authContext, projectId, {
                label,
                expiresInDays,
                appBaseUrl: process.env.APP_BASE_URL
            });

            res.status(201).json({
                status: 'success',
                data: shareLink
            });
        } catch (error) {
            next(error);
        }
    };

    private addSource = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const authContext = this.getAuthContext(req);
            const tenantId = authContext.tenantId;
            const { projectId } = req.params;
            await this.controlPlaneService.assertProjectAccess(authContext, projectId);

            const { name, sourceName, uri, sourceUri, type, connectorId, cronSchedule } = req.body;
            const resolvedName = name || sourceName;
            const storageConfig = this.buildStorageConfig(req.body);

            if (!resolvedName || (!(uri || sourceUri) && !storageConfig)) {
                res.status(400).json({ error: 'name and either uri or storageConfig are required' });
                return;
            }

            const resolvedUri = this.objectStorageService.resolveSourceUri(uri || sourceUri, storageConfig);

            if (!resolvedUri) {
                res.status(400).json({ error: 'Unable to resolve source uri' });
                return;
            }

            const existingSources = await this.sourceRepo.findAllForProject(tenantId, projectId);
            const existing = existingSources.find((source) => (
                source.uri === resolvedUri
                || source.name.toLowerCase() === resolvedName.toLowerCase()
            ));

            if (existing) {
                existing.name = resolvedName;
                existing.uri = resolvedUri;
                existing.type = type || existing.type;
                existing.connectorId = connectorId || existing.connectorId;
                existing.cronSchedule = cronSchedule || existing.cronSchedule;
                existing.storageConfig = storageConfig || existing.storageConfig;
                await this.sourceRepo.createOrUpdate(existing);

                res.status(200).json({
                    status: 'success',
                    message: 'Source already connected and refreshed',
                    data: {
                        sourceId: existing.sourceId,
                        name: existing.name,
                        uri: existing.uri,
                        type: existing.type,
                        connectorId: existing.connectorId,
                        cronSchedule: existing.cronSchedule,
                        storageConfig: existing.storageConfig,
                        deduplicated: true
                    }
                });
                return;
            }

            const sourceId = uuidv4();
            await this.sourceRepo.createOrUpdate({
                tenantId,
                projectId,
                sourceId,
                name: resolvedName,
                uri: resolvedUri,
                type: type || 'csv',
                connectorId,
                cronSchedule,
                storageConfig,
                createdAt: new Date().toISOString(),
            });

            res.status(201).json({
                status: 'success',
                message: 'Source connected to project',
                data: { sourceId, name: resolvedName, uri: resolvedUri, type: type || 'csv', connectorId, cronSchedule, storageConfig }
            });
        } catch (error) {
            next(error);
        }
    };

    private discoverSources = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { storageConfig } = req.body as { storageConfig?: ObjectStorageConfig };

            if (!storageConfig?.bucket) {
                res.status(400).json({ error: 'storageConfig.bucket is required' });
                return;
            }

            const discoveredSources = await this.objectStorageService.discoverSources(storageConfig);
            res.status(200).json({
                status: 'success',
                data: discoveredSources
            });
        } catch (error) {
            next(error);
        }
    };

    private getSources = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const authContext = this.getAuthContext(req);
            const tenantId = authContext.tenantId;
            const { projectId } = req.params;
            await this.controlPlaneService.assertProjectAccess(authContext, projectId);

            const sources = await this.sourceRepo.findAllForProject(tenantId, projectId);

            res.status(200).json({
                status: 'success',
                data: sources
            });
        } catch (error) {
            next(error);
        }
    };

    private deleteSource = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const authContext = this.getAuthContext(req);
            const tenantId = authContext.tenantId;
            const { projectId, sourceId } = req.params;
            await this.controlPlaneService.assertProjectAccess(authContext, projectId);

            await this.sourceRepo.deleteSource(tenantId, projectId, sourceId);

            res.status(200).json({
                status: 'success',
                message: 'Source deleted'
            });
        } catch (error) {
            next(error);
        }
    };

    private runRuntime = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const authContext = this.getAuthContext(req);
            const tenantId = authContext.tenantId;
            const { projectId } = req.params;
            await this.controlPlaneService.assertProjectAccess(authContext, projectId);

            const sources = await this.sourceRepo.findAllForProject(tenantId, projectId);

            if (sources.length === 0) {
                res.status(400).json({
                    error: 'No sources configured for this project. Add sources first via POST /:projectId/sources'
                });
                return;
            }

            const rawSourceUris = sources.map((source) => source.uri);
            const sourceNames = sources.map((source) => source.name);
            const sourceDescriptors = sources.map((source) => ({
                sourceId: source.sourceId,
                sourceName: source.name,
                uri: source.uri,
                type: source.type,
                connectorId: source.connectorId,
                storageConfig: source.storageConfig,
                dataCursor: source.dataCursor,
                observedMetrics: source.observedMetrics
            }));

            this.orchestrationService.runRuntime(tenantId, projectId, rawSourceUris, sourceNames, sourceDescriptors)
                .catch((error) => {
                    console.error(`[ProjectController] Background Parrot runtime failed for ${projectId}:`, error);
                });

            res.status(202).json({
                status: 'accepted',
                message: 'Parrot runtime started in the background. Connect to the SSE stream to track discovery, alignment, and mindmap generation.',
                sourcesUsed: sources.length
            });
        } catch (error) {
            next(error);
        }
    };

    private checkRuntimeUpdates = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const authContext = this.getAuthContext(req);
            const tenantId = authContext.tenantId;
            const { projectId } = req.params;
            await this.controlPlaneService.assertProjectAccess(authContext, projectId);

            const result = await this.sourceUpdateMonitorService.scanProjectSources(tenantId, projectId);

            res.status(200).json({
                status: 'success',
                data: result
            });
        } catch (error) {
            next(error);
        }
    };

    private getLineage = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const authContext = this.getAuthContext(req);
            const { projectId } = req.params;
            const { project } = await this.controlPlaneService.assertProjectAccess(authContext, projectId);

            if (!project.discoveryMetadata) {
                res.status(404).json({ error: 'Mindmap data not found' });
                return;
            }

            res.status(200).json({
                status: 'success',
                data: project.discoveryMetadata
            });
        } catch (error) {
            next(error);
        }
    };

    private getAnalytics = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const authContext = this.getAuthContext(req);
            const { projectId } = req.params;
            await this.controlPlaneService.assertProjectAccess(authContext, projectId);

            const data = await this.analyticsService.getDashboardData(authContext.tenantId, projectId);

            res.status(200).json({
                status: 'success',
                data
            });
        } catch (error) {
            next(error);
        }
    };

    private getMlRecommendations = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const authContext = this.getAuthContext(req);
            const { projectId } = req.params;
            const { project } = await this.controlPlaneService.assertProjectAccess(authContext, projectId);
            const recommendations = this.extractMlRecommendations(project.discoveryMetadata);

            res.status(200).json({
                status: 'success',
                data: {
                    configured: this.mlExecutorClient.isConfigured(),
                    recommendations
                }
            });
        } catch (error) {
            next(error);
        }
    };

    private trainMlRecommendation = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const authContext = this.getAuthContext(req);
            const { projectId, recommendationId } = req.params;
            const { project } = await this.controlPlaneService.assertProjectAccess(authContext, projectId);

            if (!this.mlExecutorClient.isConfigured()) {
                res.status(503).json({
                    error: 'ML executor is not configured',
                    code: 'ml_executor_not_configured'
                });
                return;
            }

            const recommendations = this.extractMlRecommendations(project.discoveryMetadata);
            const recommendation = recommendations.find((item) => item.recommendationId === recommendationId);

            if (!recommendation) {
                res.status(404).json({ error: 'ML recommendation not found' });
                return;
            }

            const requestId = `ml-${Date.now()}`;
            const request: MLTrainRequest = {
                tenantId: authContext.tenantId,
                projectId,
                requestId,
                datasetUri: recommendation.datasetUri,
                taskType: recommendation.taskType,
                targetColumn: recommendation.targetColumn,
                featureColumns: recommendation.featureColumns,
                modelName: `${recommendation.recommendationId}-${Date.now()}`,
                testSize: recommendation.request?.testSize,
                randomState: recommendation.request?.randomState,
                hyperparameters: req.body?.hyperparameters
            };

            const result = await this.mlExecutorClient.train(request);
            this.updateRecommendationState(project.discoveryMetadata, recommendation.recommendationId, {
                ...recommendation,
                status: 'trained',
                lastRun: {
                    requestId,
                    status: result?.status || 'trained',
                    modelId: result?.model_id || result?.modelId,
                    metrics: result?.metrics,
                    executedAt: new Date().toISOString()
                }
            });

            await this.projectRepo.createOrUpdate(project);

            res.status(202).json({
                status: 'accepted',
                message: 'ML training was approved and submitted.',
                data: result
            });
        } catch (error: any) {
            if (req.params?.projectId && req.params?.recommendationId && req.authContext?.tenantId) {
                await this.markMlRecommendationFailed(
                    req.authContext.tenantId,
                    req.params.projectId,
                    req.params.recommendationId,
                    error.message
                );
            }
            next(error);
        }
    };

    private extractMlRecommendations(discoveryMetadata: any): ParrotMLRecommendation[] {
        if (!discoveryMetadata) return [];
        if (Array.isArray(discoveryMetadata.mlRecommendations)) {
            return discoveryMetadata.mlRecommendations as ParrotMLRecommendation[];
        }

        if (Array.isArray(discoveryMetadata.projectionPlan?.mlRecommendations)) {
            return discoveryMetadata.projectionPlan.mlRecommendations as ParrotMLRecommendation[];
        }

        return [];
    }

    private updateRecommendationState(discoveryMetadata: any, recommendationId: string, nextRecommendation: ParrotMLRecommendation): void {
        if (!discoveryMetadata) return;

        if (Array.isArray(discoveryMetadata.mlRecommendations)) {
            discoveryMetadata.mlRecommendations = discoveryMetadata.mlRecommendations.map((item: ParrotMLRecommendation) => (
                item.recommendationId === recommendationId ? nextRecommendation : item
            ));
        }

        if (Array.isArray(discoveryMetadata.projectionPlan?.mlRecommendations)) {
            discoveryMetadata.projectionPlan.mlRecommendations = discoveryMetadata.projectionPlan.mlRecommendations.map((item: ParrotMLRecommendation) => (
                item.recommendationId === recommendationId ? nextRecommendation : item
            ));
        }
    }

    private async markMlRecommendationFailed(tenantId: string, projectId: string, recommendationId: string, errorMessage: string): Promise<void> {
        const project = await this.projectRepo.findById(tenantId, projectId);
        if (!project?.discoveryMetadata) return;

        const recommendation = this.extractMlRecommendations(project.discoveryMetadata).find((item) => item.recommendationId === recommendationId);
        if (!recommendation) return;

        this.updateRecommendationState(project.discoveryMetadata, recommendationId, {
            ...recommendation,
            status: 'failed',
            lastRun: {
                requestId: `ml-${Date.now()}`,
                status: 'failed',
                executedAt: new Date().toISOString(),
                error: errorMessage
            }
        });

        await this.projectRepo.createOrUpdate(project);
    }

    private getCodeFormulas = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const authContext = this.getAuthContext(req);
            const { projectId } = req.params;
            const { project } = await this.controlPlaneService.assertProjectAccess(authContext, projectId);
            const discoveryMetadata = project.discoveryMetadata || {};
            const formulas = this.decisionOverrideService.buildFormulaViews({
                querySpecs: discoveryMetadata.querySpecs || discoveryMetadata.projectionPlan?.querySpecs || [],
                projectionSpecs: discoveryMetadata.projectionSpecs || discoveryMetadata.projectionPlan?.projectionSpecs || [],
                mlRecommendations: this.extractMlRecommendations(discoveryMetadata),
                overrides: this.extractDecisionOverrides(discoveryMetadata)
            });

            res.status(200).json({
                status: 'success',
                data: {
                    formulas
                }
            });
        } catch (error) {
            next(error);
        }
    };

    private getDecisionOverrides = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const authContext = this.getAuthContext(req);
            const { projectId } = req.params;
            const { project } = await this.controlPlaneService.assertProjectAccess(authContext, projectId);

            res.status(200).json({
                status: 'success',
                data: {
                    overrides: this.extractDecisionOverrides(project.discoveryMetadata)
                }
            });
        } catch (error) {
            next(error);
        }
    };

    private createDecisionOverride = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const authContext = this.getAuthContext(req);
            const { projectId } = req.params;
            const { project } = await this.controlPlaneService.assertProjectAccess(authContext, projectId);
            const { targetType, targetId, codeFormula, userIntent } = req.body as {
                targetType?: ParrotDecisionOverride['targetType'];
                targetId?: string;
                codeFormula?: string;
                userIntent?: string;
            };

            if (!targetType || !targetId) {
                res.status(400).json({ error: 'targetType and targetId are required' });
                return;
            }

            const override = this.decisionOverrideService.buildOverride({
                targetType,
                targetId,
                codeFormula,
                userIntent,
                createdBy: authContext.userId
            });
            project.discoveryMetadata = project.discoveryMetadata || {};
            const existingOverrides = this.extractDecisionOverrides(project.discoveryMetadata)
                .filter((item) => !(item.targetType === override.targetType && item.targetId === override.targetId));
            project.discoveryMetadata.decisionOverrides = [...existingOverrides, override];

            if (override.status !== 'blocked') {
                project.queryConfigs = this.applyOverrideToProjectQueries(project.queryConfigs || [], project.discoveryMetadata, override);
            }

            await this.projectRepo.createOrUpdate(project);

            res.status(override.status === 'blocked' ? 422 : 201).json({
                status: override.status === 'blocked' ? 'blocked' : 'success',
                data: {
                    override,
                    executionWarning: override.status === 'warning'
                        ? 'Override saved, but Sentinel will warn before execution.'
                        : undefined
                }
            });
        } catch (error) {
            next(error);
        }
    };

    private recordSentinelFeedback = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const authContext = this.getAuthContext(req);
            const { projectId } = req.params;
            const { project } = await this.controlPlaneService.assertProjectAccess(authContext, projectId);
            const body = req.body as Partial<ParrotSentinelFeedbackEvent>;

            if (!body.targetType || !body.targetId || !body.action) {
                res.status(400).json({ error: 'targetType, targetId and action are required' });
                return;
            }

            const result = await this.sentinelFeedbackService.recordFeedback(authContext.tenantId, projectId, {
                targetType: body.targetType,
                targetId: body.targetId,
                sourceId: body.sourceId,
                action: body.action,
                reward: typeof body.reward === 'number' ? body.reward : this.rewardForAction(body.action),
                metadata: body.metadata || {},
                actorHash: this.sentinelFeedbackService.hashActor(authContext.userId)
            });

            project.discoveryMetadata = project.discoveryMetadata || {};
            project.discoveryMetadata.sentinelPolicyState = result.policyState;
            await this.projectRepo.createOrUpdate(project);

            res.status(201).json({
                status: 'success',
                data: result
            });
        } catch (error) {
            next(error);
        }
    };

    private extractDecisionOverrides(discoveryMetadata: any): ParrotDecisionOverride[] {
        return Array.isArray(discoveryMetadata?.decisionOverrides)
            ? discoveryMetadata.decisionOverrides as ParrotDecisionOverride[]
            : [];
    }

    private applyOverrideToProjectQueries(
        queryConfigs: Array<{ widgetId: string; sqlString: string }>,
        discoveryMetadata: any,
        override: ParrotDecisionOverride
    ): Array<{ widgetId: string; sqlString: string }> {
        const querySpecs = discoveryMetadata.querySpecs || discoveryMetadata.projectionPlan?.querySpecs || [];
        const matchingQuery = querySpecs.find((querySpec: any) => (
            querySpec.queryId === override.targetId
            || querySpec.widgetId === override.targetId
        ));
        const normalizedOverride = matchingQuery && override.targetType === 'query'
            ? { ...override, targetId: matchingQuery.widgetId }
            : override;

        return this.decisionOverrideService.applyOverrideToQueryConfigs(queryConfigs, normalizedOverride);
    }

    private rewardForAction(action: ParrotSentinelFeedbackEvent['action']): number {
        switch (action) {
            case 'accept':
            case 'execute':
                return 1;
            case 'edit':
            case 'override':
                return 0.4;
            case 'reject':
            case 'dismiss':
                return -0.6;
            case 'view':
            default:
                return 0.1;
        }
    }

    private buildStorageConfig(body: Record<string, any>): ObjectStorageConfig | undefined {
        if (body.storageConfig) {
            return body.storageConfig as ObjectStorageConfig;
        }

        if (!body.bucket) {
            return undefined;
        }

        return {
            provider: body.provider || 'generic_s3',
            endpoint: body.endpoint,
            bucket: body.bucket,
            prefix: body.prefix,
            region: body.region,
            useSsl: body.useSsl,
            urlStyle: body.urlStyle,
            fileFormat: body.fileFormat || 'parquet',
            globPattern: body.globPattern,
            credentials: body.accessKeyId && body.secretAccessKey
                ? {
                    accessKeyId: body.accessKeyId,
                    secretAccessKey: body.secretAccessKey,
                    sessionToken: body.sessionToken,
                }
                : undefined,
        };
    }

    private getRequestedWorkspaceId(req: Request): string | undefined {
        const headerWorkspaceId = req.headers['x-workspace-id'];
        const queryWorkspaceId = typeof req.query.workspaceId === 'string' ? req.query.workspaceId : undefined;
        const bodyWorkspaceId = typeof req.body?.workspaceId === 'string' ? req.body.workspaceId : undefined;

        if (typeof headerWorkspaceId === 'string' && headerWorkspaceId.trim()) {
            return headerWorkspaceId.trim();
        }

        return bodyWorkspaceId || queryWorkspaceId || req.workspaceId;
    }

    private getAuthContext(req: Request) {
        if (!req.authContext) {
            throw new AppError('Auth context missing from request.', 500);
        }

        return req.authContext;
    }

    private buildDefaultViewLink(projectName: string, projectId: string): string {
        const slug = projectName
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        return `https://app.sentry.local/view/${slug || projectId}`;
    }
}
