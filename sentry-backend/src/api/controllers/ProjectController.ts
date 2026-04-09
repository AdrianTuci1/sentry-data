import { Request, Response, NextFunction } from 'express';
import { IController } from './IController';
import { Router } from 'express';
import { OrchestrationService } from '../../application/services/OrchestrationService';
import { AnalyticsService } from '../../application/services/AnalyticsService';
import { requireAuth } from '../middlewares/auth';
import { AuthService } from '../../application/services/AuthService';
import { ProjectRepository } from '../../infrastructure/repositories/ProjectRepository';
import { SourceRepository } from '../../infrastructure/repositories/SourceRepository';
import { v4 as uuidv4 } from 'uuid';
import { ObjectStorageConfig } from '../../types/storage';
import { ObjectStorageService } from '../../application/services/ObjectStorageService';
import { SourceUpdateMonitorService } from '../../application/services/SourceUpdateMonitorService';
import { ConnectorCatalogService } from '../../application/services/ConnectorCatalogService';

export class ProjectController implements IController {
    public path = '/projects';
    public router = Router();
    private orchestrationService: OrchestrationService;
    private analyticsService: AnalyticsService;
    private authService: AuthService;
    private projectRepo: ProjectRepository;
    private sourceRepo: SourceRepository;
    private objectStorageService: ObjectStorageService;
    private sourceUpdateMonitorService: SourceUpdateMonitorService;
    private connectorCatalogService: ConnectorCatalogService;

    constructor(
        orchestrationService: OrchestrationService,
        analyticsService: AnalyticsService,
        authService: AuthService,
        projectRepo: ProjectRepository,
        sourceRepo: SourceRepository,
        objectStorageService: ObjectStorageService,
        sourceUpdateMonitorService: SourceUpdateMonitorService,
        connectorCatalogService: ConnectorCatalogService
    ) {
        this.orchestrationService = orchestrationService;
        this.analyticsService = analyticsService;
        this.authService = authService;
        this.projectRepo = projectRepo;
        this.sourceRepo = sourceRepo;
        this.objectStorageService = objectStorageService;
        this.sourceUpdateMonitorService = sourceUpdateMonitorService;
        this.connectorCatalogService = connectorCatalogService;
        this.initRoutes();
    }

    public initRoutes() {
        const auth = requireAuth(this.authService);

        this.router.get('/', auth, this.getProjects);
        this.router.post('/', auth, this.createProject);
        this.router.get('/connectors/catalog', auth, this.getConnectorCatalog);

        // Source CRUD
        this.router.post('/:projectId/sources', auth, this.addSource);
        this.router.get('/:projectId/sources', auth, this.getSources);
        this.router.post('/:projectId/sources/discover', auth, this.discoverSources);
        this.router.delete('/:projectId/sources/:sourceId', auth, this.deleteSource);

        this.router.get('/:projectId', auth, this.getProjectById);
        this.router.post('/:projectId/runtime/run', auth, this.runRuntime);
        this.router.post('/:projectId/runtime/check-updates', auth, this.checkRuntimeUpdates);

        // Endpoints for Frontend data extraction
        this.router.get('/:projectId/lineage', auth, this.getLineage);
        this.router.get('/:projectId/analytics', auth, this.getAnalytics);
    }

    private getProjects = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const tenantId = req.tenantId!;

            const projects = await this.projectRepo.findAllForTenant(tenantId);

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
            const tenantId = req.tenantId!;
            const { projectId } = req.params;

            const project = await this.projectRepo.findById(tenantId, projectId);

            if (!project) {
                res.status(404).json({ error: 'Project not found' });
                return;
            }

            res.status(200).json({
                status: 'success',
                data: project
            });
        } catch (error) {
            next(error);
        }
    };

    private createProject = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const tenantId = req.tenantId!;
            const { name } = req.body;

            // In a real scenario, creates an active record in DynamoDB
            const projectId = `proj_${Date.now()}`;

            res.status(201).json({
                status: 'success',
                message: 'Project created',
                data: { projectId, name }
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

    // ─── Source CRUD ──────────────────────────────────────────────

    private addSource = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const tenantId = req.tenantId!;
            const { projectId } = req.params;
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
            const tenantId = req.tenantId!;
            const { projectId } = req.params;

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
            const tenantId = req.tenantId!;
            const { projectId, sourceId } = req.params;

            await this.sourceRepo.deleteSource(tenantId, projectId, sourceId);

            res.status(200).json({
                status: 'success',
                message: 'Source deleted'
            });
        } catch (error) {
            next(error);
        }
    };

    // ─── Runtime ─────────────────────────────────────────────────

    private runRuntime = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const tenantId = req.tenantId!;
            const { projectId } = req.params;

            // Read source URIs from persisted sources (no longer ad-hoc from request body)
            const sources = await this.sourceRepo.findAllForProject(tenantId, projectId);

            if (sources.length === 0) {
                res.status(400).json({
                    error: 'No sources configured for this project. Add sources first via POST /:projectId/sources'
                });
                return;
            }

            const rawSourceUris = sources.map(s => s.uri);
            const sourceNames = sources.map(s => s.name);
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

            // Fire and forget. Progress is streamed over SSE by the Parrot runtime.
            this.orchestrationService.runRuntime(tenantId, projectId, rawSourceUris, sourceNames, sourceDescriptors)
                .catch(err => {
                    console.error(`[ProjectController] Background Parrot runtime failed for ${projectId}:`, err);
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
            const tenantId = req.tenantId!;
            const { projectId } = req.params;
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
            const tenantId = req.tenantId!;
            const { projectId } = req.params;
            const project = await this.projectRepo.findById(tenantId, projectId);

            if (!project || !project.discoveryMetadata) {
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
            const tenantId = req.tenantId!;
            const { projectId } = req.params;

            // Fetch live data from the analytics worker via the analytics service
            const data = await this.analyticsService.getDashboardData(tenantId, projectId);

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
}
