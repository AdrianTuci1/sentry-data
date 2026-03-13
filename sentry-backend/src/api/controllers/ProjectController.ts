import { Request, Response, NextFunction } from 'express';
import { IController } from './IController';
import { Router } from 'express';
import { OrchestrationService } from '../../application/services/OrchestrationService';
import { requireAuth } from '../middlewares/auth';
import { AuthService } from '../../application/services/AuthService';
import { ProjectRepository } from '../../infrastructure/repositories/ProjectRepository';
import { SourceRepository } from '../../infrastructure/repositories/SourceRepository';
import { v4 as uuidv4 } from 'uuid';

export class ProjectController implements IController {
    public path = '/projects';
    public router = Router();
    private orchestrationService: OrchestrationService;
    private authService: AuthService;
    private projectRepo: ProjectRepository;
    private sourceRepo: SourceRepository;

    constructor(
        orchestrationService: OrchestrationService,
        authService: AuthService,
        projectRepo: ProjectRepository,
        sourceRepo: SourceRepository
    ) {
        this.orchestrationService = orchestrationService;
        this.authService = authService;
        this.projectRepo = projectRepo;
        this.sourceRepo = sourceRepo;
        this.initRoutes();
    }

    public initRoutes() {
        const auth = requireAuth(this.authService);

        this.router.get('/', auth, this.getProjects);
        this.router.post('/', auth, this.createProject);

        // Source CRUD
        this.router.post('/:projectId/sources', auth, this.addSource);
        this.router.get('/:projectId/sources', auth, this.getSources);
        this.router.delete('/:projectId/sources/:sourceId', auth, this.deleteSource);

        this.router.get('/:projectId', auth, this.getProjectById);
        this.router.post('/:projectId/pipeline/run', auth, this.runPipeline);

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

    // ─── Source CRUD ──────────────────────────────────────────────

    private addSource = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const tenantId = req.tenantId!;
            const { projectId } = req.params;
            const { name, uri, type, cronSchedule } = req.body;

            if (!name || !uri) {
                res.status(400).json({ error: 'name and uri are required' });
                return;
            }

            const sourceId = uuidv4();
            await this.sourceRepo.createOrUpdate({
                tenantId,
                projectId,
                sourceId,
                name,
                uri,
                type: type || 'csv',
                cronSchedule,
                createdAt: new Date().toISOString(),
            });

            res.status(201).json({
                status: 'success',
                message: 'Source connected to project',
                data: { sourceId, name, uri, type: type || 'csv', cronSchedule }
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

    // ─── Pipeline ─────────────────────────────────────────────────

    private runPipeline = async (req: Request, res: Response, next: NextFunction) => {
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

            // Fire and forget (Runs asynchronously in background)
            // It will communicate its progress via SSE using SSEManager inside OrchestrationService
            this.orchestrationService.runFullPipeline(tenantId, projectId, rawSourceUris, sourceNames)
                .catch(err => {
                    console.error(`[ProjectController] Background pipeline failed for ${projectId}:`, err);
                });

            res.status(202).json({
                status: 'accepted',
                message: 'End-to-end pipeline started in the background. Connect to the SSE stream to track progress.',
                sourcesUsed: sources.length
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
                res.status(404).json({ error: 'Lineage data not found' });
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
            const project = await this.projectRepo.findById(tenantId, projectId);

            if (!project) {
                res.status(404).json({ error: 'Project not found' });
                return;
            }

            res.status(200).json({
                status: 'success',
                data: {
                    queryConfigs: project.queryConfigs || [],
                    dashboards: project.discoveryMetadata?.dashboards || []
                }
            });
        } catch (error) {
            next(error);
        }
    };
}
