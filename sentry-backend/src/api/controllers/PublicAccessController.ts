import { NextFunction, Request, Response, Router } from 'express';
import { IController } from './IController';
import { AuthService } from '../../application/services/AuthService';
import { requireAuth } from '../middlewares/auth';
import { ControlPlaneService } from '../../application/services/ControlPlaneService';
import { AnalyticsService } from '../../application/services/AnalyticsService';
import { AppError } from '../middlewares/errorHandler';

export class PublicAccessController implements IController {
    public path = '/public';
    public router = Router();

    constructor(
        private readonly authService: AuthService,
        private readonly controlPlaneService: ControlPlaneService,
        private readonly analyticsService: AnalyticsService
    ) {
        this.initRoutes();
    }

    public initRoutes() {
        const auth = requireAuth(this.authService);

        this.router.get('/invitations/:tenantId/:workspaceId/:inviteToken', this.previewInvitation);
        this.router.post('/invitations/:tenantId/:workspaceId/:inviteToken/accept', auth, this.acceptInvitation);
        this.router.get('/projects/:tenantId/:projectId/share/:shareToken', this.getSharedProject);
    }

    private previewInvitation = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId, workspaceId, inviteToken } = req.params;
            const preview = await this.controlPlaneService.previewInvitation(tenantId, workspaceId, inviteToken);

            res.status(200).json({
                status: 'success',
                data: {
                    workspace: preview.workspace,
                    invitation: preview.invitation
                }
            });
        } catch (error) {
            next(error);
        }
    };

    private acceptInvitation = async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.authContext) {
                throw new AppError('Auth context missing from request.', 500);
            }

            const { tenantId, workspaceId, inviteToken } = req.params;
            const result = await this.controlPlaneService.acceptInvitation(req.authContext, tenantId, workspaceId, inviteToken);

            res.status(200).json({
                status: 'success',
                data: result
            });
        } catch (error) {
            next(error);
        }
    };

    private getSharedProject = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { tenantId, projectId, shareToken } = req.params;
            const { project, workspace, share } = await this.controlPlaneService.resolveSharedProject(tenantId, projectId, shareToken);
            const analytics = await this.analyticsService.getDashboardData(tenantId, projectId).catch(() => null);

            res.status(200).json({
                status: 'success',
                data: {
                    tenantId,
                    workspace: {
                        workspaceId: workspace.workspaceId,
                        name: workspace.name,
                        slug: workspace.slug
                    },
                    project: {
                        projectId: project.projectId,
                        name: project.name,
                        status: project.status,
                        discoveryMetadata: project.discoveryMetadata,
                        viewLink: project.viewLink
                    },
                    share: {
                        shareId: share.shareId,
                        label: share.label,
                        access: share.access,
                        expiresAt: share.expiresAt
                    },
                    analytics
                }
            });
        } catch (error) {
            next(error);
        }
    };
}
