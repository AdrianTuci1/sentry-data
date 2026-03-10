import { Request, Response, NextFunction } from 'express';
import { IController } from './IController';
import { Router } from 'express';
import { OrchestrationService } from '../../application/services/OrchestrationService';
import { requireAuth } from '../middlewares/auth';
import { AuthService } from '../../application/services/AuthService';
import { ProjectRepository } from '../../infrastructure/repositories/ProjectRepository';

export class ProjectController implements IController {
    public path = '/projects';
    public router = Router();
    private orchestrationService: OrchestrationService;
    private authService: AuthService;
    private projectRepo: ProjectRepository;

    constructor(orchestrationService: OrchestrationService, authService: AuthService, projectRepo: ProjectRepository) {
        this.orchestrationService = orchestrationService;
        this.authService = authService;
        this.projectRepo = projectRepo;
        this.initRoutes();
    }

    public initRoutes() {
        const auth = requireAuth(this.authService);

        this.router.get('/', auth, this.getProjects);
        this.router.post('/', auth, this.createProject);
        this.router.post('/:projectId/sources', auth, this.addSource);
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

    private addSource = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const tenantId = req.tenantId!;
            const { projectId } = req.params;
            const { sourceName, sourceUri } = req.body;

            res.status(200).json({
                status: 'success',
                message: 'Source connected to project',
                data: { sourceName, sourceUri }
            });
        } catch (error) {
            next(error);
        }
    };

    private runPipeline = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const tenantId = req.tenantId!;
            const { projectId } = req.params;
            const { rawSourceUris } = req.body; // Array of URIs

            if (!rawSourceUris || !Array.isArray(rawSourceUris) || rawSourceUris.length === 0) {
                res.status(400).json({ error: 'rawSourceUris array is required' });
                return;
            }

            // Fire and forget (Runs asynchronously in background)
            // It will communicate its progress via SSE using SSEManager inside OrchestrationService
            this.orchestrationService.runFullPipeline(tenantId, projectId, rawSourceUris)
                .catch(err => {
                    console.error(`[ProjectController] Background pipeline failed for ${projectId}:`, err);
                });

            res.status(202).json({
                status: 'accepted',
                message: 'End-to-end pipeline started in the background. Connect to the SSE stream to track progress.'
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
