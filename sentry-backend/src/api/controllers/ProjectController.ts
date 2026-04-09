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
import { AppError } from '../middlewares/errorHandler';
import { ProjectMemberInput } from '../../types/controlPlane';

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
        private readonly controlPlaneService: ControlPlaneService
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
